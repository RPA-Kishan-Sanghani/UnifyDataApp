#!/usr/bin/env python3
"""
Chat Handler - Coordinates SQL generation and execution with retry logic
Reads JSON from stdin, processes query, writes JSON to stdout
"""

import sys
import json
from sql_generator import SQLGenerator
from db_executor import DatabaseExecutor

def filter_data_dictionary_by_layer(data_dictionary, layer):
    """
    Filter data dictionary to prefer tables matching the layer naming convention.
    For Bronze layer, prefer tables/schemas with '_bronze' suffix.
    For Silver layer, prefer tables/schemas with '_silver' suffix.
    For Gold layer, prefer tables/schemas with '_gold' suffix.
    """
    if not layer or not data_dictionary:
        return data_dictionary
    
    layer_lower = layer.lower()
    layer_suffix = f"_{layer_lower}"
    
    # Get unique tables before filtering
    unique_before = set()
    for entry in data_dictionary:
        table_key = f"{entry.get('schemaName', '')}.{entry.get('tableName', '')}"
        unique_before.add(table_key)
    
    print(f"[DEBUG] Layer filtering: layer={layer}, suffix={layer_suffix}", file=sys.stderr)
    print(f"[DEBUG] Tables before filtering: {sorted(unique_before)}", file=sys.stderr)
    
    # First, try to find tables/schemas matching the layer suffix
    layer_matching = [
        entry for entry in data_dictionary
        if (entry.get('schemaName', '').lower().endswith(layer_suffix) or 
            entry.get('tableName', '').lower().endswith(layer_suffix))
    ]
    
    # Get unique tables after filtering
    unique_after = set()
    for entry in layer_matching:
        table_key = f"{entry.get('schemaName', '')}.{entry.get('tableName', '')}"
        unique_after.add(table_key)
    
    print(f"[DEBUG] Tables after filtering: {sorted(unique_after)}", file=sys.stderr)
    
    # If we found layer-matching tables, use those preferentially
    if layer_matching:
        print(f"[DEBUG] Using {len(unique_after)} layer-matched tables", file=sys.stderr)
        return layer_matching
    
    # Otherwise, return all (no layer-specific tables found)
    print(f"[DEBUG] No layer-matched tables found, returning all {len(unique_before)} tables", file=sys.stderr)
    return data_dictionary

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        user_query = input_data['user_query']
        data_dictionary = input_data['data_dictionary']
        db_config = input_data['db_config']
        conversation_history = input_data.get('conversation_history', [])
        previous_error = input_data.get('previous_error')
        attempt = input_data.get('attempt', 1)
        table_override = input_data.get('table_override')
        layer = input_data.get('layer', '')
        connection_name = input_data.get('connection_name', '')
        chart_context = input_data.get('chart_context')
        
        # If editing a chart, prepend context to the user query
        if chart_context:
            context_prompt = f"""I want to edit this existing chart:

Chart Title: {chart_context.get('title', 'Untitled')}
Chart Type: {chart_context.get('chartType', 'Unknown')}
Current SQL Query:
{chart_context.get('sql', 'No SQL available')}

User's edit request: {user_query}

Please modify the SQL query based on the user's request while maintaining the chart's purpose. Return the updated SQL query."""
            user_query = context_prompt
        
        # Initialize SQL generator
        sql_gen = SQLGenerator()
        
        # Restore conversation history if provided
        if conversation_history:
            sql_gen.conversation_history = conversation_history
        
        # Apply layer-aware filtering first (prefer layer-matching tables)
        if not table_override:
            # Only apply automatic layer filtering if user hasn't manually selected tables
            data_dictionary = filter_data_dictionary_by_layer(data_dictionary, layer)
        
        # Filter data dictionary if table override is provided
        if table_override:
            # Handle both single table (string) and multiple tables (array)
            if isinstance(table_override, str):
                table_override = [table_override]
            
            # Filter to only the specified tables
            filtered_entries = []
            for table_spec in table_override:
                schema_table = table_spec.split('.')
                if len(schema_table) == 2:
                    schema_name, table_name = schema_table
                    filtered_entries.extend([
                        entry for entry in data_dictionary
                        if entry.get('schemaName') == schema_name and entry.get('tableName') == table_name
                    ])
            data_dictionary = filtered_entries
        
        # Generate SQL with retry logic
        max_attempts = 3
        current_attempt = attempt
        sql_query = None
        explanation = None
        execution_result = None
        error_message = None
        
        while current_attempt <= max_attempts:
            try:
                # Generate SQL or direct response
                sql_query, explanation, chart_type = sql_gen.generate_sql(
                    user_query=user_query,
                    data_dictionary=data_dictionary,
                    database_type=db_config.get('dbType', 'postgresql'),
                    previous_error=previous_error if current_attempt > 1 else None,
                    attempt=current_attempt,
                    layer=layer  # Pass layer context to Gemini
                )
                
                # Check if this is a metadata-only response (no SQL execution needed)
                if sql_query is None or sql_query.strip() == '':
                    # Direct answer without SQL execution
                    result = {
                        'success': True,
                        'sql': None,
                        'explanation': explanation,
                        'data': [],
                        'columns': [],
                        'row_count': 0,
                        'attempt': current_attempt,
                        'conversation_history': sql_gen.conversation_history,
                        'metadata_only': True,
                        'chart_type': None
                    }
                    print(json.dumps(result))
                    return
                
                # Initialize database executor for SQL queries
                with DatabaseExecutor(db_config) as db_executor:
                    # Execute SQL
                    execution_result = db_executor.execute_query(
                        sql=sql_query,
                        validate_first=True,
                        max_rows=1000
                    )
                    
                    if execution_result['success']:
                        # Success! Return results
                        result = {
                            'success': True,
                            'sql': sql_query,
                            'explanation': explanation,
                            'data': execution_result['data'],
                            'columns': execution_result['columns'],
                            'row_count': execution_result['row_count'],
                            'attempt': current_attempt,
                            'conversation_history': sql_gen.conversation_history,
                            'chart_type': chart_type
                        }
                        print(json.dumps(result))
                        return
                    else:
                        # Execution failed, retry
                        error_message = execution_result['error']
                        previous_error = error_message
                        current_attempt += 1
                        
                        if current_attempt > max_attempts:
                            # Max attempts reached, offer table selection
                            available_tables = sql_gen.get_tables_from_schema(data_dictionary)
                            result = {
                                'success': False,
                                'error': error_message,
                                'sql': sql_query,
                                'explanation': explanation,
                                'attempt': current_attempt - 1,
                                'max_attempts_reached': True,
                                'available_tables': available_tables,
                                'message': 'Unable to generate valid SQL after 3 attempts. Please select the correct table.',
                                'chart_type': chart_type
                            }
                            print(json.dumps(result))
                            return
                
            except Exception as e:
                error_message = str(e)
                current_attempt += 1
                
                if current_attempt > max_attempts:
                    result = {
                        'success': False,
                        'error': error_message,
                        'sql': sql_query,
                        'attempt': current_attempt - 1,
                        'max_attempts_reached': True
                    }
                    print(json.dumps(result))
                    return
                
                previous_error = error_message
        
        # Shouldn't reach here, but just in case
        result = {
            'success': False,
            'error': 'Unknown error occurred',
            'attempt': current_attempt
        }
        print(json.dumps(result))
        
    except Exception as e:
        # Top-level error
        error_result = {
            'success': False,
            'error': f'Chat handler error: {str(e)}'
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
