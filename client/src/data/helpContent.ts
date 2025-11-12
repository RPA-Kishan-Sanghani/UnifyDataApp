export interface FieldDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: string;
  example?: string;
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
  overview: string;
  workflow: string[];
  fields?: FieldDefinition[];
  subsections?: {
    title: string;
    content: string;
  }[];
  troubleshooting?: string[];
  screenshots?: {
    src: string;
    alt: string;
    caption: string;
  }[];
}

export const helpSections: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: 'Home',
    overview: 'The Dashboard provides a comprehensive overview of your data pipeline health and performance metrics. It displays real-time statistics, pipeline summaries, and detailed DAG execution information across all data layers (Bronze, Silver, Gold).',
    workflow: [
      'Upon logging in, you\'ll land on the Dashboard automatically',
      'Review the metric cards at the top showing Total Runs, Successful, Failed, and Running pipelines',
      'Use the date range picker to filter data for specific time periods',
      'Examine pipeline summaries organized by execution layer (Bronze/Silver/Gold)',
      'Browse the detailed DAG table for granular pipeline information',
      'Apply filters by status, layer, or search by pipeline name',
      'Sort columns by clicking on column headers',
      'Use pagination controls to navigate through large datasets'
    ],
    subsections: [
      {
        title: 'Metric Cards',
        content: 'The top section displays four key metrics: **Total Runs** (all pipeline executions), **Successful** (completed without errors), **Failed** (encountered errors), and **Running** (currently executing). These update based on your selected date range.'
      },
      {
        title: 'Pipeline Summary',
        content: 'Categorized view of pipelines grouped by execution layer. Shows counts of Regular Pipelines, Data Quality checks, and Data Reconciliation tasks for each layer (Bronze, Silver, Gold).'
      },
      {
        title: 'DAG Table',
        content: 'Detailed table showing individual pipeline executions with columns for Pipeline Name, Status, Layer, Start Time, Duration, Source System, and Target Table. Supports sorting, filtering, and pagination.'
      }
    ],
    troubleshooting: [
      'If metrics show "0" for all values, check your database connection settings',
      'If data doesn\'t update, verify your date range selection includes recent data',
      'If filters don\'t work, try refreshing the page or clearing browser cache',
      'If the table is empty, ensure you have pipeline execution data in your audit tables'
    ]
  },
  {
    id: 'application-config',
    title: 'Application Config',
    icon: 'Settings',
    overview: 'Application Config allows you to register and manage all applications that interact with your data pipelines. This central registry helps track application metadata, ownership, and dependencies.',
    workflow: [
      'Navigate to "Application Config" from the sidebar',
      'Click "Add New Application" button to create a new entry',
      'Fill in all required fields in the form',
      'Optionally add description and department information',
      'Set the application status (Active/Inactive)',
      'Click "Save" to create the configuration',
      'Use search and filters to find specific applications',
      'Edit existing configs by clicking the Edit icon',
      'Delete configs by clicking the Trash icon (with confirmation)'
    ],
    fields: [
      {
        name: 'Application Type',
        type: 'Text',
        required: true,
        description: 'Category or type of the application (e.g., API, Web App, ETL Tool)',
        validation: 'Minimum 1 character required',
        example: 'ETL Pipeline'
      },
      {
        name: 'Application Name',
        type: 'Text',
        required: true,
        description: 'Unique identifier name for the application',
        validation: 'Minimum 1 character, maximum 100 characters',
        example: 'CustomerDataSync'
      },
      {
        name: 'Application Owner',
        type: 'Text',
        required: false,
        description: 'Name or email of the person/team responsible for this application',
        example: 'data-engineering@company.com'
      },
      {
        name: 'Application Description',
        type: 'Textarea',
        required: false,
        description: 'Detailed description of the application\'s purpose and functionality',
        example: 'Syncs customer data from CRM to data warehouse on hourly schedule'
      },
      {
        name: 'Department',
        type: 'Text',
        required: false,
        description: 'Department or business unit that owns this application',
        example: 'Data Engineering'
      },
      {
        name: 'Status',
        type: 'Select',
        required: false,
        description: 'Current operational status of the application',
        validation: 'Options: Active, Inactive',
        example: 'Active'
      }
    ],
    troubleshooting: [
      'If you can\'t see the form, ensure your database connection is configured',
      'If save fails, check that all required fields are filled',
      'If duplicate name error occurs, choose a unique application name',
      'If filters don\'t work properly, try refreshing the page'
    ]
  },
  {
    id: 'source-connections',
    title: 'Source Connections',
    icon: 'Database',
    overview: 'Source Connections manages your database connectivity configurations. This is where you configure connections to external databases (MySQL, PostgreSQL) that store your application data, audit logs, and pipeline metadata.',
    workflow: [
      'Go to "Source Connections" from the sidebar',
      'Click "Add New Connection" to create a connection',
      'Select the database type (MySQL or PostgreSQL)',
      'Enter connection details (host, port, database name)',
      'Provide authentication credentials (username, password)',
      'Click "Test Connection" to verify connectivity',
      'Save the connection configuration',
      'Select this connection in other modules (Chat, Custom Dashboard)',
      'Edit or delete connections as needed'
    ],
    fields: [
      {
        name: 'Connection Name',
        type: 'Text',
        required: true,
        description: 'Friendly name to identify this database connection',
        validation: 'Must be unique',
        example: 'Production_MySQL'
      },
      {
        name: 'Database Type',
        type: 'Select',
        required: true,
        description: 'Type of database management system',
        validation: 'Options: MySQL, PostgreSQL',
        example: 'PostgreSQL'
      },
      {
        name: 'Host',
        type: 'Text',
        required: true,
        description: 'Hostname or IP address of the database server',
        example: '192.168.1.100 or db.example.com'
      },
      {
        name: 'Port',
        type: 'Number',
        required: true,
        description: 'Port number the database listens on',
        validation: 'Default: 3306 for MySQL, 5432 for PostgreSQL',
        example: '5432'
      },
      {
        name: 'Database Name',
        type: 'Text',
        required: true,
        description: 'Name of the specific database/schema to connect to',
        example: 'analytics_prod'
      },
      {
        name: 'Username',
        type: 'Text',
        required: true,
        description: 'Database user with appropriate permissions',
        example: 'readonly_user'
      },
      {
        name: 'Password',
        type: 'Password',
        required: true,
        description: 'Password for the database user',
        validation: 'Encrypted and stored securely',
        example: '••••••••'
      }
    ],
    subsections: [
      {
        title: 'Security Considerations',
        content: 'Passwords are encrypted before storage. Use read-only database accounts when possible. Ensure your database server allows connections from the UnifyData AI server IP address.'
      },
      {
        title: 'Testing Connections',
        content: 'Always test connections before saving. A successful test verifies network connectivity, credentials, and database accessibility. Failed tests will show specific error messages.'
      }
    ],
    troubleshooting: [
      'If "Test Connection" fails, verify host/port are correct and firewall allows access',
      'If authentication fails, double-check username and password',
      'If database not found, ensure the database name exists on the server',
      'If timeout occurs, check network connectivity and firewall rules',
      'For PostgreSQL, ensure the database allows password authentication (not just peer)'
    ]
  },
  {
    id: 'data-pipeline',
    title: 'Data Pipeline',
    icon: 'GitBranch',
    overview: 'Data Pipeline configuration lets you define and manage your data pipeline orchestration settings. Configure execution schedules, transformation rules, and dependencies between pipeline stages.',
    workflow: [
      'Access "Data Pipeline" from the sidebar',
      'Click "Add Pipeline" to create a new configuration',
      'Define the pipeline name and description',
      'Select source and target connections',
      'Set execution layer (Bronze, Silver, or Gold)',
      'Configure schedule (cron expression or interval)',
      'Define transformation logic or SQL queries',
      'Set up error handling and retry policies',
      'Save the pipeline configuration',
      'Monitor pipeline executions on the Dashboard'
    ],
    fields: [
      {
        name: 'Pipeline Name',
        type: 'Text',
        required: true,
        description: 'Unique identifier for the pipeline',
        example: 'customer_bronze_ingestion'
      },
      {
        name: 'Execution Layer',
        type: 'Select',
        required: true,
        description: 'Data layer designation (Bronze for raw, Silver for cleaned, Gold for aggregated)',
        validation: 'Must be lowercase: bronze, silver, or gold',
        example: 'bronze'
      },
      {
        name: 'Source System',
        type: 'Text',
        required: true,
        description: 'Name of the system data is extracted from',
        example: 'SAP_ERP'
      },
      {
        name: 'Target Table',
        type: 'Text',
        required: true,
        description: 'Destination table name in the data warehouse',
        example: 'bronze.customer_raw'
      },
      {
        name: 'Schedule',
        type: 'Text',
        required: false,
        description: 'Cron expression or interval for automatic execution',
        example: '0 2 * * * (runs daily at 2 AM)'
      }
    ],
    troubleshooting: [
      'If pipeline doesn\'t execute, verify schedule syntax is correct',
      'If data doesn\'t appear, check source and target connection settings',
      'If pipeline fails, review error logs in the Dashboard',
      'If transformations fail, validate SQL syntax and data types'
    ]
  },
  {
    id: 'data-dictionary',
    title: 'Data Dictionary',
    icon: 'FileText',
    overview: 'The Data Dictionary is your central metadata repository. It documents all database tables, columns, data types, relationships, and business definitions. This helps teams understand data structures and maintain consistency across the organization.',
    workflow: [
      'Navigate to "Data Dictionary" from the sidebar',
      'View tables grouped by schema, layer, and target system',
      'Click on a table row to expand and see all column definitions',
      'Click "Add Entry" to document a new table/column',
      'Fill in metadata fields including column name, data type, and description',
      'Specify constraints (Primary Key, Foreign Key, Not Null)',
      'Add business definitions and examples',
      'Use inline editing to update existing entries quickly',
      'Apply filters to find specific tables or columns',
      'Export documentation for sharing with team members'
    ],
    fields: [
      {
        name: 'Schema Name',
        type: 'Text',
        required: true,
        description: 'Database schema containing the table',
        example: 'public'
      },
      {
        name: 'Table Name',
        type: 'Text',
        required: true,
        description: 'Name of the database table',
        example: 'customers'
      },
      {
        name: 'Execution Layer',
        type: 'Select',
        required: true,
        description: 'Data layer classification',
        validation: 'Must be lowercase: bronze, silver, or gold',
        example: 'silver'
      },
      {
        name: 'Target System',
        type: 'Text',
        required: false,
        description: 'Destination system or database',
        example: 'Snowflake'
      },
      {
        name: 'Attribute Name',
        type: 'Text',
        required: true,
        description: 'Column or field name',
        example: 'customer_id'
      },
      {
        name: 'Data Type',
        type: 'Text',
        required: true,
        description: 'SQL data type of the column',
        example: 'VARCHAR(50) or INTEGER'
      },
      {
        name: 'Precision',
        type: 'Number',
        required: false,
        description: 'Total number of digits for numeric types',
        example: '10'
      },
      {
        name: 'Length',
        type: 'Number',
        required: false,
        description: 'Maximum length for character types',
        example: '255'
      },
      {
        name: 'Scale',
        type: 'Number',
        required: false,
        description: 'Number of digits after decimal point',
        example: '2'
      },
      {
        name: 'Is Primary Key',
        type: 'Select',
        required: false,
        description: 'Whether this column is part of the primary key',
        validation: 'Y or N',
        example: 'Y'
      },
      {
        name: 'Is Foreign Key',
        type: 'Select',
        required: false,
        description: 'Whether this column references another table',
        validation: 'Y or N',
        example: 'N'
      },
      {
        name: 'Foreign Key Table',
        type: 'Text',
        required: false,
        description: 'Referenced table name (if foreign key)',
        example: 'orders'
      },
      {
        name: 'Is Not Null',
        type: 'Select',
        required: false,
        description: 'Whether the column allows NULL values',
        validation: 'Y (not null) or N (nullable)',
        example: 'Y'
      },
      {
        name: 'Column Description',
        type: 'Textarea',
        required: false,
        description: 'Business definition and usage notes for the column',
        example: 'Unique identifier for customer records, auto-incrementing integer'
      }
    ],
    subsections: [
      {
        title: 'Table Grouping',
        content: 'Tables are automatically grouped by schema name, table name, and execution layer. Click the expand icon to view all columns within a table. The entry count shows how many columns are documented.'
      },
      {
        title: 'Inline Editing',
        content: 'Click the edit icon on any column row to enable inline editing. Modify values directly in the table, then click the checkmark to save or X to cancel. This allows quick updates without opening a separate form.'
      },
      {
        title: 'Filtering and Search',
        content: 'Use the search bar to find tables or columns by name. Apply layer, schema, table, or target system filters to narrow down results. Filters work in combination for precise searches.'
      }
    ],
    troubleshooting: [
      'If tables don\'t group correctly, ensure schema_name and table_name are consistent',
      'If inline edit doesn\'t save, check for validation errors on required fields',
      'If entries duplicate, verify you\'re not creating the same column twice',
      'If filters show no results, check filter combinations and try clearing filters'
    ]
  },
  {
    id: 'data-reconciliation',
    title: 'Data Reconciliation',
    icon: 'RefreshCw',
    overview: 'Data Reconciliation helps you verify data consistency between source and target systems. Define reconciliation rules, compare record counts, validate data quality, and identify discrepancies automatically.',
    workflow: [
      'Go to "Data Reconciliation" from the sidebar',
      'Click "Add Reconciliation Config" to create a new check',
      'Define source and target data sources',
      'Specify reconciliation keys (matching columns)',
      'Set comparison rules (count matching, value matching, etc.)',
      'Configure tolerance thresholds for acceptable differences',
      'Schedule automated reconciliation runs',
      'Review reconciliation results on the Dashboard',
      'Investigate discrepancies when failures occur',
      'Export reconciliation reports for auditing'
    ],
    fields: [
      {
        name: 'Reconciliation Name',
        type: 'Text',
        required: true,
        description: 'Unique identifier for this reconciliation check',
        example: 'daily_customer_recon'
      },
      {
        name: 'Source Connection',
        type: 'Select',
        required: true,
        description: 'Database connection for the source system',
        example: 'SAP_Production'
      },
      {
        name: 'Target Connection',
        type: 'Select',
        required: true,
        description: 'Database connection for the target system',
        example: 'Snowflake_DW'
      },
      {
        name: 'Source Table/Query',
        type: 'Textarea',
        required: true,
        description: 'Table name or SQL query to fetch source data',
        example: 'SELECT customer_id, amount FROM orders WHERE date >= CURRENT_DATE'
      },
      {
        name: 'Target Table/Query',
        type: 'Textarea',
        required: true,
        description: 'Table name or SQL query to fetch target data',
        example: 'SELECT customer_id, amount FROM staging.orders'
      },
      {
        name: 'Reconciliation Key',
        type: 'Text',
        required: true,
        description: 'Column(s) to match records between source and target',
        validation: 'Comma-separated for composite keys',
        example: 'customer_id, order_date'
      },
      {
        name: 'Comparison Type',
        type: 'Select',
        required: true,
        description: 'Type of reconciliation check to perform',
        validation: 'Options: Count Match, Value Match, Both',
        example: 'Both'
      },
      {
        name: 'Tolerance Percentage',
        type: 'Number',
        required: false,
        description: 'Acceptable difference threshold (0-100)',
        example: '0.1 (allows 0.1% difference)'
      }
    ],
    subsections: [
      {
        title: 'Reconciliation Types',
        content: '**Count Match**: Compares row counts between source and target. **Value Match**: Compares actual data values for matched records. **Both**: Performs both count and value validation for comprehensive checking.'
      },
      {
        title: 'Handling Discrepancies',
        content: 'When reconciliation fails, the system logs detailed information about missing records, count differences, and value mismatches. Use this data to investigate and fix data quality issues.'
      }
    ],
    troubleshooting: [
      'If reconciliation always fails, verify source and target queries return matching columns',
      'If keys don\'t match, ensure reconciliation key names exist in both datasets',
      'If performance is slow, add indexes on reconciliation key columns',
      'If tolerance isn\'t working, check that it\'s a percentage value between 0-100'
    ]
  },
  {
    id: 'data-quality',
    title: 'Data Quality',
    icon: 'BarChart3',
    overview: 'Data Quality module allows you to define validation rules and quality checks for your data. Monitor completeness, accuracy, consistency, and timeliness of data across all pipelines and layers.',
    workflow: [
      'Navigate to "Data Quality" from the sidebar',
      'Click "Add Quality Rule" to create a validation',
      'Select the table and column to validate',
      'Choose rule type (Not Null, Range Check, Pattern Match, etc.)',
      'Configure rule parameters and expected values',
      'Set severity level (Warning, Error, Critical)',
      'Schedule automated quality checks',
      'View quality scores and failures on Dashboard',
      'Drill down into failed records for investigation',
      'Export quality reports for compliance'
    ],
    fields: [
      {
        name: 'Rule Name',
        type: 'Text',
        required: true,
        description: 'Descriptive name for the quality rule',
        example: 'email_format_validation'
      },
      {
        name: 'Table Name',
        type: 'Text',
        required: true,
        description: 'Table to apply the quality check on',
        example: 'customers'
      },
      {
        name: 'Column Name',
        type: 'Text',
        required: true,
        description: 'Specific column to validate',
        example: 'email_address'
      },
      {
        name: 'Rule Type',
        type: 'Select',
        required: true,
        description: 'Type of validation to perform',
        validation: 'Options: Not Null, Unique, Range, Pattern, Custom SQL',
        example: 'Pattern'
      },
      {
        name: 'Rule Expression',
        type: 'Textarea',
        required: true,
        description: 'Validation logic (regex pattern, SQL condition, etc.)',
        example: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
      },
      {
        name: 'Severity',
        type: 'Select',
        required: true,
        description: 'Impact level when rule fails',
        validation: 'Options: Warning, Error, Critical',
        example: 'Error'
      },
      {
        name: 'Failure Threshold',
        type: 'Number',
        required: false,
        description: 'Maximum percentage of records allowed to fail',
        example: '5 (allows up to 5% failures)'
      }
    ],
    subsections: [
      {
        title: 'Rule Types Explained',
        content: '**Not Null**: Checks for missing values. **Unique**: Ensures no duplicates. **Range**: Validates numeric values within bounds. **Pattern**: Uses regex for format validation. **Custom SQL**: Runs user-defined SQL validation queries.'
      },
      {
        title: 'Quality Scoring',
        content: 'Quality scores are calculated as: (passing records / total records) × 100. Scores are aggregated at table, layer, and system levels to provide hierarchical quality metrics.'
      }
    ],
    troubleshooting: [
      'If rules don\'t execute, check that table and column names are correct',
      'If regex patterns fail, test them in a regex validator first',
      'If custom SQL is slow, optimize queries with proper indexes',
      'If failure thresholds trigger incorrectly, review threshold percentages'
    ]
  },
  {
    id: 'custom-dashboard',
    title: 'Custom Dashboard',
    icon: 'LayoutDashboard',
    overview: 'Custom Dashboard allows you to create personalized views by pinning your favorite charts and insights from AI chat conversations. Organize charts in a drag-and-drop grid layout, resize tiles, and keep important metrics always visible.',
    workflow: [
      'Start by chatting with your data using the Chat feature',
      'When AI generates a chart you want to keep, click the "Pin" icon',
      'Navigate to "Custom Dashboard" to see all pinned charts',
      'Drag charts to rearrange them in your preferred layout',
      'Resize charts by dragging the corner handles',
      'Click the "Edit" icon to modify chart details',
      'Use "Edit with AI" (sparkles icon) to request chart modifications',
      'Remove charts by clicking the "Unpin" icon',
      'Your layout is automatically saved',
      'Switch between database connections to see different dashboards'
    ],
    fields: [
      {
        name: 'Chart Title',
        type: 'Text',
        required: true,
        description: 'Descriptive title for the chart',
        example: 'Monthly Revenue Trend'
      },
      {
        name: 'Chart Type',
        type: 'Select',
        required: true,
        description: 'Visualization type',
        validation: 'Options: line, bar, area, pie',
        example: 'line'
      },
      {
        name: 'SQL Query',
        type: 'Textarea',
        required: true,
        description: 'SQL query that generates the chart data',
        example: 'SELECT month, SUM(revenue) FROM sales GROUP BY month'
      },
      {
        name: 'Layout Position',
        type: 'Auto',
        required: false,
        description: 'Grid coordinates and size (managed by drag-and-drop)',
        example: 'Automatically saved'
      }
    ],
    subsections: [
      {
        title: 'Grid Layout',
        content: 'The dashboard uses a 3-column responsive grid. Each chart can span 1-3 columns in width and has flexible height. Drag the small grip icon in the top-left corner to move charts. Drag corners to resize.'
      },
      {
        title: 'Edit with AI',
        content: 'Click the sparkles icon to modify a chart using natural language. The chart context is sent to AI automatically. You can request changes like "show as bar chart", "add last 6 months filter", or "group by category".'
      },
      {
        title: 'Connection Scoping',
        content: 'Charts are scoped to the database connection and execution layer they were created with. When you switch connections, you\'ll see a different set of pinned charts relevant to that data source.'
      }
    ],
    troubleshooting: [
      'If charts don\'t appear, verify you\'re on the correct connection/layer',
      'If drag-and-drop doesn\'t work, try refreshing the page',
      'If Edit with AI fails, check your internet connection and try again',
      'If charts show errors, verify the underlying SQL query is still valid',
      'If layout resets, ensure browser localStorage is enabled'
    ]
  },
  {
    id: 'chat',
    title: 'Chat with Your Data',
    icon: 'MessageCircle',
    overview: 'Chat with Your Data is an AI-powered assistant that lets you query your databases using natural language. Ask questions in plain English, and the AI generates SQL queries, executes them, and visualizes results automatically. It uses Google Gemini AI for intelligent query understanding.',
    workflow: [
      'Click the "Chat" button (usually at the bottom-right) to open the chat panel',
      'Select your database connection from the dropdown',
      'Choose the execution layer (Bronze, Silver, or Gold)',
      'Type your question in natural language',
      'AI interprets your question and generates appropriate SQL',
      'Results are displayed as tables or charts automatically',
      'Click "Pin" to save important charts to Custom Dashboard',
      'Use "Edit with AI" on charts to request modifications',
      'View chat history to revisit previous conversations',
      'Export data or charts for external use'
    ],
    fields: [
      {
        name: 'Database Connection',
        type: 'Select',
        required: true,
        description: 'Select which database to query',
        example: 'Production MySQL'
      },
      {
        name: 'Execution Layer',
        type: 'Select',
        required: true,
        description: 'Data layer to query (affects available tables)',
        validation: 'Must be lowercase: bronze, silver, or gold',
        example: 'silver'
      },
      {
        name: 'Query Input',
        type: 'Textarea',
        required: true,
        description: 'Your question or request in natural language',
        example: 'Show me total sales by month for the last year'
      }
    ],
    subsections: [
      {
        title: 'Types of Questions',
        content: '**Metadata queries**: "List all tables", "Describe the customers table" (answered from data dictionary). **Data queries**: "How many orders yesterday?", "Top 10 customers by revenue" (generates and executes SQL).'
      },
      {
        title: 'Chart Generation',
        content: 'AI automatically selects appropriate chart types based on your data. Line charts for trends, bar charts for comparisons, pie charts for distributions. You can request specific types: "show as bar chart".'
      },
      {
        title: 'Session Management',
        content: 'Chat conversations are saved automatically (last 10 sessions per connection/layer). Resume previous conversations by selecting from chat history. Context is maintained within a session for follow-up questions.'
      },
      {
        title: 'SQL Preview',
        content: 'Generated SQL queries are shown in the response, allowing you to review and understand what the AI executed. You can copy the SQL for use in other tools or modify it manually.'
      }
    ],
    troubleshooting: [
      'If AI doesn\'t understand, try rephrasing with specific table/column names',
      'If SQL errors occur, check if requested columns/tables exist in data dictionary',
      'If no charts appear, verify your query returns numeric data for visualization',
      'If connection fails, check database connection settings in Source Connections',
      'If AI response is slow, complex queries may take longer to generate and execute'
    ]
  }
];
