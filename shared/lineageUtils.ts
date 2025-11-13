/**
 * Shared utilities for lineage node ID generation
 * Used by both backend (lineage-graph.ts) and frontend (data-lineage.tsx)
 * to ensure consistent node IDs across the stack
 */

/**
 * Generate unique node ID, handling null schema/table/column values
 * Returns null if table is missing (invalid node)
 * 
 * Examples:
 * - getNodeId('bronze', 'users', null) => 'bronze.users'
 * - getNodeId(null, 'users', null) => 'users'
 * - getNodeId('bronze', 'users', 'id') => 'bronze.users.id'
 * - getNodeId(null, null, null) => null
 */
export function getNodeId(schema: string | null, table: string | null, column: string | null): string | null {
  if (!table) return null;
  const schemaPrefix = schema ? `${schema}.` : '';
  const columnSuffix = column ? `.${column}` : '';
  return `${schemaPrefix}${table}${columnSuffix}`;
}

/**
 * Generate table key for indexing, handling null schema
 * Returns null if table is missing
 * 
 * Examples:
 * - getTableKey('bronze', 'users') => 'bronze.users'
 * - getTableKey(null, 'users') => 'users'
 * - getTableKey(null, null) => null
 */
export function getTableKey(schema: string | null, table: string | null): string | null {
  if (!table) return null;
  return schema ? `${schema}.${table}` : table;
}
