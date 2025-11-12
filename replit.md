# Overview

This is a full-stack data operations dashboard application built for monitoring and managing data pipelines. The application provides a comprehensive view of pipeline metrics, DAG (Directed Acyclic Graph) status, and error tracking across different data layers (Bronze, Silver, Gold). It's designed to give data engineers and operations teams real-time visibility into their data pipeline health and performance.

The dashboard features metric cards showing pipeline run statistics, categorized DAG summaries by data layer, and a detailed table view with filtering and sorting capabilities for pipeline management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React 18** with TypeScript for the user interface
- **Tailwind CSS** for styling with a custom design system using CSS variables
- **shadcn/ui** component library built on Radix UI primitives for consistent, accessible components
- **TanStack Query** for server state management, caching, and data fetching
- **Wouter** for lightweight client-side routing
- **Vite** as the build tool and development server with hot module replacement

## Backend Architecture
- **Node.js** with **Express.js** providing a RESTful API
- **TypeScript** throughout the entire stack for type safety
- Custom middleware for request logging and error handling
- Modular route structure with separation of concerns between routes and storage layers

## Data Storage Solutions
- **PostgreSQL** as the primary database
- **Drizzle ORM** for type-safe database operations and schema management
- **NeonDB** serverless PostgreSQL for authentication and admin data
  - Admin Database (NeonDB): Stores users, user_activity, and user_config_db_settings
  - Location: ep-misty-mountain-afd65hmo.c-2.us-west-2.aws.neon.tech
  - Database: neondb
- User-configured external databases store application data:
  - `audit_table` - Pipeline execution tracking and metrics
  - `error_table` - Error logging and failure analysis
  - Other pipeline-specific tables based on user configuration

### Database Migration History
- **October 22, 2025**: Migrated authentication system from external PostgreSQL (4.240.90.166) to NeonDB
  - Migrated 4 users with bcrypt-hashed passwords
  - Migrated user activity records and database configuration settings
  - All credentials now stored securely in NeonDB

### Security Considerations
- ⚠️ **Production TODO**: Database credentials are currently hardcoded in `server/db.ts`
- For production deployment, move credentials to environment variables or secret manager
- User passwords are hashed using bcrypt (10 salt rounds) before storage
- JWT tokens used for authentication (SECRET should be set via environment variable)

## Database Schema Design
The audit table tracks comprehensive pipeline execution data including:
- Pipeline identification (code name, run ID, source system)
- Execution timing (start/end times)
- Data processing metrics (inserted, updated, deleted row counts)
- Status tracking and layer categorization

The error table maintains detailed failure logs linked to audit records for debugging and monitoring.

## API Structure
RESTful endpoints organized around dashboard functionality:
- `/api/dashboard/metrics` - Aggregate pipeline statistics from multiple sources
- `/api/dashboard/pipeline-summary` - Category-wise pipeline summaries by type and layer
- `/api/dashboard/dags` - Detailed pipeline listings with filtering, sorting, and pagination

### Dashboard Data Sources (November 8, 2025)
The dashboard now fetches pipeline data from three separate tables in the user's external database:

1. **Regular Pipelines** (Bronze/Silver/Gold layers):
   - Source: `audit_table`
   - Columns used: `start_time`, `status`, `schema_name`, `code_name`, `source_system`, `target_table_name`
   - Categories pipelines by schema_name patterns (bronze/silver/gold)

2. **Data Quality Pipelines**:
   - Source: `data_quality_output_table`
   - Expected columns: `execution_date`, `validation_status`
   - Status values: 'Success', 'Failed'

3. **Data Reconciliation Pipelines**:
   - Source: `recon_result`
   - Expected columns: `execution_date`, `recon_status`
   - Status values: 'Success', 'Failed'

All endpoints gracefully handle missing tables with error logging. Date range filtering and status filtering work across all three sources.

All endpoints support date range filtering and return JSON responses with proper error handling.

## Component Architecture
- Modular component structure with reusable UI components
- Custom hooks for data fetching and state management
- Responsive design with mobile-first approach
- Component composition pattern using Radix UI primitives

## AI Chat Assistant
- **Google Gemini 2.5 Flash** for natural language SQL generation
- Intelligent query routing: distinguishes between metadata queries and data queries
- **Metadata queries** (list tables, describe schema, show relationships) are answered directly from the data dictionary without SQL execution
- **Data queries** (counts, aggregations, filtering) generate and execute SQL against the user's database
- Python services for SQL generation (`sql_generator.py`) and database execution (`db_executor.py`)
- Persistent chat history stored in user's config database with session management
- Auto-save of all conversations with 10-session limit per connection/layer combination
- Smart retry logic with up to 3 attempts for SQL generation errors

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless** - Serverless PostgreSQL database connectivity
- **drizzle-orm** and **drizzle-zod** - Type-safe ORM with schema validation
- **@tanstack/react-query** - Server state management and data fetching
- **wouter** - Lightweight React routing

## UI and Styling Dependencies
- **@radix-ui/** components - Accessible UI primitives (accordion, dialog, dropdown-menu, etc.)
- **tailwindcss** - Utility-first CSS framework
- **class-variance-authority** and **clsx** - Dynamic className utilities
- **lucide-react** - Icon library

## Development and Build Tools
- **vite** - Build tool and development server
- **typescript** - Type checking and compilation
- **esbuild** - Fast JavaScript bundler for production builds
- **@replit/vite-plugin-runtime-error-modal** - Development error handling

## Database and Session Management
- **connect-pg-simple** - PostgreSQL session store for Express
- **ws** - WebSocket implementation for database connections

## Utility Libraries
- **date-fns** - Date manipulation and formatting
- **nanoid** - Unique ID generation
- **@hookform/resolvers** - Form validation resolvers