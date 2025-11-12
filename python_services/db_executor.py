"""
Database Executor Service
Executes SQL queries on target databases using user_config_db_settings
"""

import psycopg2
import psycopg2.extras
import pymysql
import pymysql.cursors
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
import json

class DatabaseExecutor:
    def __init__(self, connection_config: Dict[str, Any]):
        """
        Initialize database executor with connection configuration
        
        Args:
            connection_config: Dictionary with database connection parameters
                - host: Database host
                - port: Database port
                - database: Database name
                - username: Database user
                - password: Database password
                - dbType: Database type (postgresql, mysql, etc)
        """
        self.config = connection_config
        self.db_type = connection_config.get('dbType', 'postgresql').lower()
        self.connection = None
    
    def connect(self) -> bool:
        """
        Establish connection to the database
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if self.db_type == 'postgresql':
                self.connection = psycopg2.connect(
                    host=self.config.get('host', 'localhost'),
                    port=self.config.get('port', 5432),
                    database=self.config.get('database', ''),
                    user=self.config.get('username', ''),
                    password=self.config.get('password', '')
                )
                return True
            elif self.db_type == 'mysql':
                self.connection = pymysql.connect(
                    host=self.config.get('host', 'localhost'),
                    port=self.config.get('port', 3306),
                    database=self.config.get('database', ''),
                    user=self.config.get('username', ''),
                    password=self.config.get('password', ''),
                    cursorclass=pymysql.cursors.DictCursor
                )
                return True
            else:
                raise ValueError(f"Unsupported database type: {self.db_type}")
        except Exception as e:
            raise Exception(f"Failed to connect to database: {str(e)}")
    
    def validate_sql(self, sql: str) -> Tuple[bool, Optional[str]]:
        """
        Validate SQL query without executing it
        
        Args:
            sql: SQL query to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.connection:
            return False, "No active database connection"
        
        try:
            cursor = self.connection.cursor()
            
            # Use EXPLAIN to validate without executing
            # This catches syntax errors and missing tables/columns
            validation_sql = f"EXPLAIN {sql}"
            cursor.execute(validation_sql)
            cursor.close()
            
            return True, None
            
        except (psycopg2.Error, pymysql.Error) as e:
            error_msg = str(e)
            # Extract the most relevant part of the error
            if 'DETAIL:' in error_msg:
                error_msg = error_msg.split('DETAIL:')[0].strip()
            return False, error_msg
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def execute_query(
        self,
        sql: str,
        validate_first: bool = True,
        max_rows: int = 1000
    ) -> Dict[str, Any]:
        """
        Execute SQL query and return results
        
        Args:
            sql: SQL query to execute
            validate_first: Whether to validate before executing
            max_rows: Maximum number of rows to return
            
        Returns:
            Dictionary with results:
                - success: bool
                - data: list of dictionaries (rows)
                - columns: list of column names
                - row_count: number of rows
                - error: error message if failed
        """
        if not self.connection:
            return {
                'success': False,
                'error': 'No active database connection',
                'data': [],
                'columns': [],
                'row_count': 0
            }
        
        # Validate first if requested
        if validate_first:
            is_valid, error = self.validate_sql(sql)
            if not is_valid:
                return {
                    'success': False,
                    'error': f'SQL validation failed: {error}',
                    'data': [],
                    'columns': [],
                    'row_count': 0
                }
        
        try:
            # Create cursor based on database type
            if self.db_type == 'postgresql':
                cursor = self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            else:  # MySQL
                cursor = self.connection.cursor()
            
            # Add LIMIT if not present in SELECT queries
            sql_upper = sql.strip().upper()
            if sql_upper.startswith('SELECT') and 'LIMIT' not in sql_upper:
                sql = f"{sql.rstrip(';')} LIMIT {max_rows}"
            
            cursor.execute(sql)
            
            # Fetch results
            if cursor.description:  # SELECT query
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                # Convert to list of dicts
                if self.db_type == 'postgresql':
                    data = [dict(row) for row in rows]
                else:  # MySQL already returns dicts with DictCursor
                    data = list(rows)
                row_count = len(data)
            else:  # INSERT/UPDATE/DELETE
                self.connection.commit()
                data = []
                columns = []
                row_count = cursor.rowcount
            
            cursor.close()
            
            return {
                'success': True,
                'data': data,
                'columns': columns,
                'row_count': row_count,
                'error': None
            }
            
        except (psycopg2.Error, pymysql.Error) as e:
            self.connection.rollback()
            error_msg = str(e)
            if 'DETAIL:' in error_msg:
                error_msg = error_msg.split('DETAIL:')[0].strip()
            
            return {
                'success': False,
                'error': error_msg,
                'data': [],
                'columns': [],
                'row_count': 0
            }
        except Exception as e:
            self.connection.rollback()
            return {
                'success': False,
                'error': f'Execution error: {str(e)}',
                'data': [],
                'columns': [],
                'row_count': 0
            }
    
    def get_dataframe(self, sql: str) -> Optional[pd.DataFrame]:
        """
        Execute query and return results as pandas DataFrame
        
        Args:
            sql: SQL query to execute
            
        Returns:
            pandas DataFrame or None if error
        """
        result = self.execute_query(sql, validate_first=True)
        
        if result['success'] and result['data']:
            return pd.DataFrame(result['data'])
        return None
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test database connection
        
        Returns:
            Dictionary with test results
        """
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            cursor.execute('SELECT 1 as test')
            result = cursor.fetchone()
            cursor.close()
            
            return {
                'success': True,
                'message': 'Connection successful',
                'database': self.config.get('database'),
                'host': self.config.get('host')
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
                'database': self.config.get('database'),
                'host': self.config.get('host')
            }
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
