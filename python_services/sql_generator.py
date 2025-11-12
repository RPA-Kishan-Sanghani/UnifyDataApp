"""
SQL Generator Service using Google Gemini API
Generates SQL queries from natural language with retry logic and error handling
"""

import os
import json
import google.generativeai as genai
from typing import Dict, List, Optional, Tuple

# Configure Gemini API
genai.configure(api_key=os.environ.get('GEMINI_API_KEY', ''))

class SQLGenerator:
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        """Initialize SQL Generator with specified Gemini model"""
        self.model = genai.GenerativeModel(model_name)
        self.max_retries = 3
        self.conversation_history = []
    
    def generate_sql(
        self,
        user_query: str,
        data_dictionary: List[Dict],
        database_type: str = "postgresql",
        previous_error: Optional[str] = None,
        attempt: int = 1,
        layer: str = ""
    ) -> Tuple[str, str, str]:
        """
        Generate SQL query from natural language using data dictionary context
        
        Args:
            user_query: Natural language query from user
            data_dictionary: List of data dictionary entries with schema info
            database_type: Type of database (postgresql, mysql, etc)
            previous_error: Error from previous SQL execution attempt
            attempt: Current attempt number (1-3)
            layer: Data layer context (Bronze, Silver, Gold) for table disambiguation
            
        Returns:
            Tuple of (sql_query, explanation, chart_type)
        """
        
        if attempt > self.max_retries:
            raise Exception(f"Maximum retry attempts ({self.max_retries}) exceeded")
        
        # Build context from data dictionary
        schema_context = self._build_schema_context(data_dictionary, layer)
        
        # Build prompt based on whether this is a retry
        if previous_error:
            prompt = self._build_retry_prompt(
                user_query, schema_context, previous_error, attempt, database_type
            )
        else:
            prompt = self._build_initial_prompt(
                user_query, schema_context, database_type, layer
            )
        
        # Add conversation history for context
        full_prompt = self._add_conversation_context(prompt)
        
        try:
            # Generate SQL using Gemini
            response = self.model.generate_content(full_prompt)
            
            # Parse response
            sql_query, explanation, chart_type = self._parse_response(response.text)
            
            # Store in conversation history
            self.conversation_history.append({
                'role': 'user',
                'content': user_query
            })
            
            hist_entry = {
                'role': 'assistant',
                'content': explanation
            }
            if sql_query:  # Only add SQL if it's not empty
                hist_entry['sql'] = sql_query
            
            self.conversation_history.append(hist_entry)
            
            return sql_query, explanation, chart_type
            
        except Exception as e:
            raise Exception(f"Error generating SQL: {str(e)}")
    
    def _build_schema_context(self, data_dictionary: List[Dict], layer: str = "") -> str:
        """Build schema context string from data dictionary with layer awareness"""
        if not data_dictionary:
            return "No schema information available."
        
        # Group by schema and table
        schema_map = {}
        for entry in data_dictionary:
            schema_name = entry.get('schemaName', 'public')
            table_name = entry.get('tableName', 'unknown')
            key = f"{schema_name}.{table_name}"
            
            if key not in schema_map:
                schema_map[key] = []
            
            column_info = {
                'name': entry.get('attributeName', ''),
                'type': entry.get('dataType', ''),
                'length': entry.get('length'),
                'precision': entry.get('precisionValue'),
                'scale': entry.get('scale'),
                'is_primary_key': entry.get('isPrimaryKey') == 'Y',
                'is_foreign_key': entry.get('isForeignKey') == 'Y',
                'is_not_null': entry.get('isNotNull') == 'Y',
                'description': entry.get('columnDescription', '')
            }
            schema_map[key].append(column_info)
        
        # Format schema information with layer context
        context_parts = ["DATABASE SCHEMA INFORMATION:\n"]
        if layer:
            context_parts.append(f"SELECTED DATA LAYER: {layer}\n")
            context_parts.append(f"NOTE: Tables/schemas ending with '_{layer.lower()}' are preferred for this layer.\n")
        
        for table_key, columns in schema_map.items():
            context_parts.append(f"\nTable: {table_key}")
            context_parts.append("Columns:")
            for col in columns:
                pk = " (PRIMARY KEY)" if col['is_primary_key'] else ""
                fk = " (FOREIGN KEY)" if col['is_foreign_key'] else ""
                nn = " NOT NULL" if col['is_not_null'] else ""
                desc = f" -- {col['description']}" if col['description'] else ""
                
                type_info = col['type']
                if col['length']:
                    type_info += f"({col['length']})"
                elif col['precision'] and col['scale']:
                    type_info += f"({col['precision']},{col['scale']})"
                
                context_parts.append(f"  - {col['name']}: {type_info}{pk}{fk}{nn}{desc}")
        
        return "\n".join(context_parts)
    
    def _build_initial_prompt(self, user_query: str, schema_context: str, db_type: str, layer: str = "") -> str:
        """Build initial prompt for SQL generation with layer awareness"""
        layer_instructions = ""
        if layer:
            layer_instructions = f"""
LAYER-AWARE TABLE SELECTION:
The user is working with the {layer} data layer. When the user refers to a table by name (e.g., "accounts"):
1. PREFER tables/schemas that match the layer naming convention (ending with '_{layer.lower()}')
2. Example: For Bronze layer, "accounts" should refer to "finance_bronze.accounts" NOT "finance.accounts"
3. If multiple tables exist with similar names, choose the one matching the current layer
4. This is CRITICAL for data consistency - always use layer-appropriate tables
"""
        
        return f"""You are an intelligent data assistant for {db_type} databases. You help users explore and analyze their data.

{schema_context}

USER QUERY: {user_query}

CRITICAL INSTRUCTIONS - READ CAREFULLY:
This is a CHAT APPLICATION. Not all questions require SQL execution against the database.
{layer_instructions}
WHEN TO ANSWER DIRECTLY (NO SQL NEEDED):
- "list tables" / "show tables" / "what tables are available" → List table names from the schema above
- "describe table X" / "show columns in X" → Show column details from the schema above
- "show relationships" / "what are the foreign keys" → Show foreign key info from the schema above
- "explain the schema" → Describe the database structure from the schema above
- Questions about metadata, structure, or schema information → Use the schema information provided

WHEN TO GENERATE SQL (QUERY THE DATABASE):
- Questions asking for actual DATA from tables (counts, values, records, analytics)
- "how many customers..." / "show me records where..." / "what is the total..."
- Aggregations, filters, joins that need to execute against actual data
- Any question requiring live data retrieval from the database

SQL GENERATION RULES (when SQL is needed):
1. Generate syntactically correct {db_type} SQL
2. Use ONLY tables and columns from the schema above
3. Use proper schema.table qualification
4. Avoid dummy queries or UNION ALL workarounds - write real queries
5. For "Unknown database" errors, the schema prefix might not be a separate database - query the tables directly
6. Be smart about JOINs, aggregations, and filtering
7. ALWAYS respect the layer context - use layer-matching tables when available

CHART VISUALIZATION DETECTION:
Detect if the user wants a chart visualization and specify the chart type:
- PIE CHART: Distribution, composition, percentages (e.g., "pie chart for account types", "distribution of categories")
- BAR CHART: Comparisons between categories (e.g., "bar chart of sales by region", "compare revenue")
- LINE CHART: Trends over time (e.g., "line chart of monthly revenue", "trend analysis")
- HISTOGRAM: Distribution of numerical data (e.g., "histogram of account balances", "distribution of amounts")
- TABLE: Default for all other queries or when chart type is unclear

IMPORTANT: When generating SQL for charts, ensure:
1. For PIE/BAR charts: Return 2 columns (category_name, value)
2. For LINE charts: Return 2 columns (x_axis_label, y_value) ordered by x_axis
3. For HISTOGRAM: Return numerical data that can be binned
4. Use clear, readable column names (not cryptic abbreviations)

RESPONSE FORMAT (return ONLY this JSON, no markdown):

For METADATA questions (no SQL needed):
{{
  "sql": null,
  "explanation": "Your direct answer using the schema information provided",
  "requires_execution": false,
  "answer_type": "metadata",
  "chart_type": null
}}

For DATA questions (SQL needed):
{{
  "sql": "your SQL query here",
  "explanation": "brief explanation of what the query does",
  "tables_used": ["list", "of", "tables"],
  "requires_execution": true,
  "complexity": "simple|moderate|complex",
  "chart_type": "pie|bar|line|histogram|table"
}}

Analyze the query and respond appropriately:"""
    
    def _build_retry_prompt(
        self, user_query: str, schema_context: str, error: str, attempt: int, db_type: str
    ) -> str:
        """Build retry prompt with error information"""
        return f"""You are an expert SQL query generator for {db_type} databases.

{schema_context}

USER QUERY: {user_query}

PREVIOUS ATTEMPT #{attempt - 1} FAILED WITH ERROR:
{error}

INSTRUCTIONS:
1. Carefully analyze the error message above
2. Fix the syntax error or schema/table name issue
3. Double-check table and column names against the schema provided
4. Ensure proper {db_type} syntax
5. If the error mentions a missing table/column, use only what exists in the schema
6. Verify JOIN conditions are correct
7. Check for typos in table or column names

RESPONSE FORMAT (return ONLY this JSON, no markdown):
{{
  "sql": "corrected SQL query here",
  "explanation": "what was wrong and how you fixed it",
  "tables_used": ["list", "of", "tables"],
  "fix_applied": "description of the fix"
}}

Generate the corrected SQL query now:"""
    
    def _add_conversation_context(self, prompt: str) -> str:
        """Add recent conversation history for follow-up queries"""
        if not self.conversation_history:
            return prompt
        
        # Add last 4 messages (2 user + 2 assistant) for context
        recent_history = self.conversation_history[-4:]
        context = "\nRECENT CONVERSATION CONTEXT:\n"
        
        user_count = 0
        for hist in recent_history:
            if hist['role'] == 'user':
                user_count += 1
                context += f"{user_count}. User asked: {hist['content']}\n"
            elif hist['role'] == 'assistant':
                if 'sql' in hist:
                    context += f"   SQL generated: {hist['sql'][:100]}...\n"
                else:
                    context += f"   Response: {hist['content'][:100]}...\n"
        
        return context + "\n" + prompt
    
    def _parse_response(self, response_text: str) -> Tuple[str, str, str]:
        """Parse Gemini response to extract SQL, explanation, and chart_type"""
        try:
            # Remove markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.startswith('```'):
                cleaned = cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            # Parse JSON
            data = json.loads(cleaned)
            sql = data.get('sql')  # Can be None for metadata-only responses
            explanation = data.get('explanation', 'No explanation provided')
            chart_type = data.get('chart_type', 'table')  # Default to table if not specified
            
            # For metadata-only responses, SQL can be None or empty
            if sql is not None:
                sql = sql.strip()
            else:
                sql = ''  # Convert None to empty string
            
            # Normalize chart_type
            if chart_type is None or chart_type not in ['pie', 'bar', 'line', 'histogram', 'table']:
                chart_type = 'table'
            
            return sql, explanation, chart_type
            
        except json.JSONDecodeError:
            # Fallback: try to extract SQL from raw text
            lines = response_text.strip().split('\n')
            sql_lines = []
            in_sql = False
            
            for line in lines:
                if 'SELECT' in line.upper() or 'WITH' in line.upper():
                    in_sql = True
                if in_sql:
                    sql_lines.append(line)
                    if line.strip().endswith(';'):
                        break
            
            if sql_lines:
                return '\n'.join(sql_lines), "Extracted from response", 'table'
            
            raise ValueError(f"Could not parse SQL from response: {response_text[:200]}")
    
    def clear_history(self):
        """Clear conversation history"""
        self.conversation_history = []
    
    def get_tables_from_schema(self, data_dictionary: List[Dict]) -> List[Dict]:
        """Extract unique tables from data dictionary for user selection"""
        tables = {}
        for entry in data_dictionary:
            schema_name = entry.get('schemaName', 'public')
            table_name = entry.get('tableName', 'unknown')
            key = f"{schema_name}.{table_name}"
            
            if key not in tables:
                tables[key] = {
                    'schema': schema_name,
                    'table': table_name,
                    'full_name': key
                }
        
        return list(tables.values())
