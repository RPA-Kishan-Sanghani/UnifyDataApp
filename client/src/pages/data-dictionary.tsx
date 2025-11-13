import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, Filter, ChevronDown, ChevronRight, Loader2, Check, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { DataDictionaryRecord } from '@shared/schema';

// Database-specific datatype mappings
const DATABASE_DATATYPES: Record<string, string[]> = {
  'MySQL': [
    'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE',
    'BIT', 'BOOLEAN',
    'CHAR', 'VARCHAR', 'BINARY', 'VARBINARY',
    'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'ENUM', 'SET',
    'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
    'JSON', 'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON'
  ],
  'PostgreSQL': [
    'SMALLINT', 'INTEGER', 'BIGINT',
    'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'SMALLSERIAL', 'SERIAL', 'BIGSERIAL',
    'MONEY',
    'CHAR', 'VARCHAR', 'TEXT',
    'BYTEA',
    'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'DATE', 'TIME', 'TIME WITH TIME ZONE', 'INTERVAL',
    'BOOLEAN',
    'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
    'INET', 'CIDR', 'MACADDR',
    'UUID', 'JSON', 'JSONB', 'XML',
    'ARRAY', 'HSTORE'
  ],
  'SQL Server': [
    'TINYINT', 'SMALLINT', 'INT', 'BIGINT',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL',
    'MONEY', 'SMALLMONEY',
    'BIT',
    'CHAR', 'VARCHAR', 'TEXT',
    'NCHAR', 'NVARCHAR', 'NTEXT',
    'BINARY', 'VARBINARY', 'IMAGE',
    'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'SMALLDATETIME', 'DATETIMEOFFSET',
    'UNIQUEIDENTIFIER',
    'XML', 'SQL_VARIANT',
    'GEOGRAPHY', 'GEOMETRY'
  ],
  'Oracle': [
    'NUMBER', 'FLOAT', 'BINARY_FLOAT', 'BINARY_DOUBLE',
    'CHAR', 'VARCHAR2', 'NCHAR', 'NVARCHAR2',
    'LONG', 'RAW', 'LONG RAW',
    'CLOB', 'NCLOB', 'BLOB', 'BFILE',
    'DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITH LOCAL TIME ZONE',
    'INTERVAL YEAR TO MONTH', 'INTERVAL DAY TO SECOND',
    'ROWID', 'UROWID',
    'XMLType', 'JSON'
  ],
  'MongoDB': [
    'String', 'Number', 'Boolean',
    'Date', 'Timestamp',
    'Object', 'Array',
    'ObjectId', 'Binary', 'Decimal128',
    'MinKey', 'MaxKey',
    'Null', 'Undefined'
  ],
  'Snowflake': [
    'NUMBER', 'DECIMAL', 'NUMERIC', 'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'BYTEINT',
    'FLOAT', 'FLOAT4', 'FLOAT8', 'DOUBLE', 'DOUBLE PRECISION', 'REAL',
    'VARCHAR', 'CHAR', 'CHARACTER', 'STRING', 'TEXT',
    'BINARY', 'VARBINARY',
    'BOOLEAN',
    'DATE', 'DATETIME', 'TIME', 'TIMESTAMP', 'TIMESTAMP_LTZ', 'TIMESTAMP_NTZ', 'TIMESTAMP_TZ',
    'VARIANT', 'OBJECT', 'ARRAY',
    'GEOGRAPHY'
  ],
  'BigQuery': [
    'INT64', 'NUMERIC', 'BIGNUMERIC', 'FLOAT64',
    'BOOL',
    'STRING', 'BYTES',
    'DATE', 'DATETIME', 'TIME', 'TIMESTAMP',
    'STRUCT', 'ARRAY',
    'GEOGRAPHY', 'JSON'
  ]
};

interface TableGroup {
  tableName: string;
  schemaName: string;
  executionLayer: string;
  lastModified: string;
  entryCount: number;
  entries: DataDictionaryRecord[];
}

interface ExpandedRowState {
  [key: string]: boolean;
}

interface TableMetadata {
  attributeName: string;
  dataType: string;
  precision?: number;
  length?: number;
  scale?: number;
  isPrimaryKey: string;
  isForeignKey: string;
  foreignKeyTable?: string;
  columnDescription: string;
  isNotNull: string;
  dataDictionaryKey: number;
}

interface EditingState {
  [key: number]: boolean;
}

export function DataDictionary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [layerFilter, setLayerFilter] = useState("all");
  const [schemaFilter, setSchemaFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [targetSystemFilter, setTargetSystemFilter] = useState("all");
  const [expandedRows, setExpandedRows] = useState<ExpandedRowState>({});
  const [editingStates, setEditingStates] = useState<EditingState>({});
  const [editingValues, setEditingValues] = useState<{[key: number]: Partial<DataDictionaryRecord>}>({});
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all data dictionary entries
  const { data: allEntries = [], isLoading, error } = useQuery({
    queryKey: ['/api/data-dictionary'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/data-dictionary', { headers });
      if (!response.ok) {
        // If unauthorized or no config, return empty array instead of error
        if (response.status === 401 || response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch data dictionary entries');
      }
      return response.json();
    }
  });

  // Format date/time for grouping (YYYY-MM-DD HH:MM:SS)
  const formatDateTime = (date: Date | string | null | undefined): string => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Unknown';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // Group entries by schema name and last modified date/time
  const groupedTables: TableGroup[] = allEntries.reduce((acc: TableGroup[], entry: DataDictionaryRecord) => {
    const schemaName = entry.schemaName || 'Unknown';
    const lastModified = formatDateTime(entry.updateDate);
    const tableName = entry.tableName || 'Unknown';
    
    // Find existing group with same schema and last modified date/time
    const existingGroup = acc.find(group =>
      group.schemaName === schemaName && 
      group.lastModified === lastModified &&
      group.tableName === tableName
    );

    if (existingGroup) {
      existingGroup.entries.push(entry);
      existingGroup.entryCount++;
    } else {
      acc.push({
        tableName,
        schemaName,
        executionLayer: entry.executionLayer || 'Unknown',
        lastModified,
        entryCount: 1,
        entries: [entry]
      });
    }
    return acc;
  }, []);

  // Filter tables based on search and all filters (case-insensitive)
  const filteredTables = groupedTables.filter(table => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      table.tableName.toLowerCase().includes(searchLower) ||
      table.schemaName.toLowerCase().includes(searchLower) ||
      table.entries.some(entry =>
        entry.attributeName?.toLowerCase().includes(searchLower) ||
        entry.columnDescription?.toLowerCase().includes(searchLower) ||
        entry.dataType?.toLowerCase().includes(searchLower)
      );
    const matchesLayer = layerFilter === 'all' || table.executionLayer.toLowerCase() === layerFilter.toLowerCase();
    const matchesSchema = schemaFilter === 'all' || table.schemaName.toLowerCase() === schemaFilter.toLowerCase();
    const matchesTable = tableFilter === 'all' || table.tableName.toLowerCase() === tableFilter.toLowerCase();
    const matchesTargetSystem = targetSystemFilter === 'all' ||
      table.entries.some(entry => entry.createdBy?.toLowerCase() === targetSystemFilter.toLowerCase());

    return matchesSearch && matchesLayer && matchesSchema && matchesTable && matchesTargetSystem;
  });

  // Update entry mutation for inline editing
  const updateEntryMutation = useMutation({
    mutationFn: async ({id, data}: {id: number, data: Partial<DataDictionaryRecord>}) => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/data-dictionary/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update entry');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });
      toast({
        title: 'Success',
        description: 'Data dictionary entry updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update entry: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/data-dictionary/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });
      toast({
        title: 'Success',
        description: 'Data dictionary entry deleted successfully',
      });
    }
  });

  const handleEdit = (entry: DataDictionaryRecord) => {
    setLocation(`/data-dictionary/form/${entry.dataDictionaryKey}`);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this data dictionary entry?')) {
      await deleteEntryMutation.mutateAsync(id);
    }
  };

  const handleAdd = () => {
    setLocation('/data-dictionary/form');
  };

  const toggleRowExpansion = (tableKey: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [tableKey]: !prev[tableKey]
    }));
  };

  const getTableKey = (table: TableGroup) => `${table.schemaName}.${table.tableName}.${table.lastModified}`;

  const startInlineEdit = (entry: DataDictionaryRecord) => {
    setEditingStates(prev => ({ ...prev, [entry.dataDictionaryKey]: true }));
    setEditingValues(prev => ({ ...prev, [entry.dataDictionaryKey]: { ...entry } }));
  };

  const cancelInlineEdit = (id: number) => {
    setEditingStates(prev => ({ ...prev, [id]: false }));
    setEditingValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  const saveInlineEdit = async (id: number) => {
    const values = editingValues[id];
    if (values) {
      await updateEntryMutation.mutateAsync({ id, data: values });
      setEditingStates(prev => ({ ...prev, [id]: false }));
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[id];
        return newValues;
      });
    }
  };

  // Save all entries without showing individual toasts
  const saveAllInlineEdits = async (entries: DataDictionaryRecord[]) => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let successCount = 0;
      let failCount = 0;

      for (const entry of entries) {
        if (editingStates[entry.dataDictionaryKey]) {
          const values = editingValues[entry.dataDictionaryKey];
          if (values) {
            try {
              const response = await fetch(`/api/data-dictionary/${entry.dataDictionaryKey}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(values),
              });
              if (response.ok) {
                successCount++;
                setEditingStates(prev => ({ ...prev, [entry.dataDictionaryKey]: false }));
                setEditingValues(prev => {
                  const newValues = { ...prev };
                  delete newValues[entry.dataDictionaryKey];
                  return newValues;
                });
              } else {
                failCount++;
              }
            } catch (error) {
              failCount++;
            }
          }
        }
      }

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });

      // Show single toast notification
      if (failCount === 0) {
        toast({
          title: 'Success',
          description: `Successfully updated ${successCount} column${successCount !== 1 ? 's' : ''}`,
        });
      } else {
        toast({
          title: 'Partial Success',
          description: `Updated ${successCount} column${successCount !== 1 ? 's' : ''}, failed ${failCount}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update columns',
        variant: 'destructive',
      });
    }
  };

  const updateEditingValue = (id: number, field: keyof DataDictionaryRecord, value: any) => {
    setEditingValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading data dictionary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Don't show error screen - let it fall through to empty state
    console.error('Error fetching data dictionary:', error);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 bg-background">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Dictionary</h1>
            <p className="text-sm text-gray-600">Manage metadata and schema information for all data objects</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] })}
              data-testid="button-refresh-entries"
              size="sm"
            >
              Refresh
            </Button>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-entry" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mt-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tables, schemas, columns, or data types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-tables"
            />
          </div>

          <Select value={layerFilter} onValueChange={setLayerFilter}>
            <SelectTrigger className="w-48" data-testid="select-layer-filter">
              <SelectValue placeholder="Filter by layer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layers</SelectItem>
              <SelectItem value="Bronze">Bronze</SelectItem>
              <SelectItem value="Silver">Silver</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
            </SelectContent>
          </Select>

          <Select value={schemaFilter} onValueChange={setSchemaFilter}>
            <SelectTrigger className="w-48" data-testid="select-schema-filter">
              <SelectValue placeholder="Filter by schema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schemas</SelectItem>
              {Array.from(new Set(allEntries.map((entry: DataDictionaryRecord) => entry.schemaName))).filter((s): s is string => Boolean(s)).map((schema) => (
                <SelectItem key={schema} value={schema}>{schema}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-48" data-testid="select-table-filter">
              <SelectValue placeholder="Filter by table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {Array.from(new Set(allEntries.map((entry: DataDictionaryRecord) => entry.tableName))).filter((t): t is string => Boolean(t)).map((table) => (
                <SelectItem key={table} value={table}>{table}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={targetSystemFilter} onValueChange={setTargetSystemFilter}>
            <SelectTrigger className="w-48" data-testid="select-target-system-filter">
              <SelectValue placeholder="Filter by target system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Target Systems</SelectItem>
              {Array.from(new Set(allEntries.map((entry: DataDictionaryRecord) => entry.createdBy))).filter((s): s is string => Boolean(s)).map((system) => (
                <SelectItem key={system} value={system}>{system}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-sm text-gray-500">
            {filteredTables.length} table{filteredTables.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Execution Layer</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => {
                  const tableKey = getTableKey(table);
                  const isExpanded = expandedRows[tableKey];

                  return (
                    <React.Fragment key={tableKey}>
                      {/* Main Table Row */}
                      <TableRow
                        className="hover:bg-gray-50"
                        data-testid={`row-table-${tableKey}`}
                      >
                        <TableCell onClick={() => toggleRowExpansion(tableKey)} className="cursor-pointer">
                          <div className="p-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(tableKey)} className="font-medium cursor-pointer">
                          {table.schemaName || 'N/A'}
                        </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(tableKey)} className="font-medium cursor-pointer">{table.tableName}</TableCell>
                        <TableCell onClick={() => toggleRowExpansion(tableKey)} className="cursor-pointer">
                          <Badge variant={
                            table.executionLayer.toLowerCase() === 'gold' ? 'default' :
                            table.executionLayer.toLowerCase() === 'silver' ? 'secondary' : 'outline'
                          }>
                            {table.executionLayer}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(tableKey)} className="cursor-pointer">
                          <span className="text-sm text-gray-600">
                            {table.lastModified}
                          </span>
                        </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(tableKey)} className="cursor-pointer">
                          <span className="text-sm text-gray-500">
                            {table.entryCount} column{table.entryCount !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                data-testid={`button-menu-${tableKey}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  // Edit the first entry of the table
                                  if (table.entries.length > 0) {
                                    handleEdit(table.entries[0]);
                                  }
                                }}
                                data-testid={`menu-edit-${tableKey}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to delete all ${table.entryCount} column(s) from ${table.tableName}?`)) {
                                    // Delete all entries for this table
                                    for (const entry of table.entries) {
                                      await deleteEntryMutation.mutateAsync(entry.dataDictionaryKey);
                                    }
                                  }
                                }}
                                className="text-red-600"
                                data-testid={`menu-delete-${tableKey}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row with Column Metadata */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0 bg-gray-50">
                            <div className="p-4">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-medium text-gray-900">Column Metadata</h4>
                                {table.entries.some(e => editingStates[e.dataDictionaryKey]) ? (
                                  <div className="flex space-x-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        table.entries.forEach(entry => cancelInlineEdit(entry.dataDictionaryKey));
                                      }}
                                      data-testid={`button-cancel-all-${tableKey}`}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => saveAllInlineEdits(table.entries)}
                                      data-testid={`button-save-all-${tableKey}`}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Save All
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      table.entries.forEach(entry => startInlineEdit(entry));
                                    }}
                                    data-testid={`button-edit-all-${tableKey}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit All
                                  </Button>
                                )}
                              </div>
                              <div className="bg-white rounded border overflow-x-auto max-w-full">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50">
                                      <TableHead className="min-w-[150px]">Attribute Name</TableHead>
                                      <TableHead className="min-w-[120px]">Data Type</TableHead>
                                      <TableHead className="min-w-[80px]">Length</TableHead>
                                      <TableHead className="min-w-[90px]">Precision</TableHead>
                                      <TableHead className="min-w-[80px]">Scale</TableHead>
                                      <TableHead className="min-w-[100px]">Primary Key</TableHead>
                                      <TableHead className="min-w-[100px]">Foreign Key</TableHead>
                                      <TableHead className="min-w-[90px]">Not Null</TableHead>
                                      <TableHead className="min-w-[200px]">Description</TableHead>
                                      <TableHead className="min-w-[80px]">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {table.entries.filter(entry => {
                                      if (!searchTerm) return true;
                                      const searchLower = searchTerm.toLowerCase();
                                      return (
                                        entry.attributeName?.toLowerCase().includes(searchLower) ||
                                        entry.columnDescription?.toLowerCase().includes(searchLower) ||
                                        entry.dataType?.toLowerCase().includes(searchLower) ||
                                        entry.createdBy?.toLowerCase().includes(searchLower)
                                      );
                                    }).map((entry) => {
                                      const isEditing = editingStates[entry.dataDictionaryKey];
                                      const editValues = editingValues[entry.dataDictionaryKey] || entry;

                                      return (
                                        <TableRow key={entry.dataDictionaryKey} className="hover:bg-gray-50">
                                          <TableCell className="font-medium">
                                            {isEditing ? (
                                              <Input
                                                value={editValues.attributeName || ''}
                                                onChange={(e) => updateEditingValue(entry.dataDictionaryKey, 'attributeName', e.target.value)}
                                                className="w-32"
                                              />
                                            ) : (
                                              entry.attributeName
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Select
                                                value={editValues.dataType ?? entry.dataType ?? ''}
                                                onValueChange={(value) => updateEditingValue(entry.dataDictionaryKey, 'dataType', value)}
                                              >
                                                <SelectTrigger className="w-32" data-testid={`select-data-type-${entry.dataDictionaryKey}`}>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {Array.from(new Set(Object.values(DATABASE_DATATYPES).flat())).sort().map((type) => (
                                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Badge variant="outline">{entry.dataType}</Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Input
                                                type="number"
                                                value={editValues.length || ''}
                                                onChange={(e) => updateEditingValue(entry.dataDictionaryKey, 'length', e.target.value ? parseInt(e.target.value) : null)}
                                                className="w-20"
                                              />
                                            ) : (
                                              entry.length || '-'
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Input
                                                type="number"
                                                value={editValues.precisionValue || ''}
                                                onChange={(e) => updateEditingValue(entry.dataDictionaryKey, 'precisionValue', e.target.value ? parseInt(e.target.value) : null)}
                                                className="w-20"
                                              />
                                            ) : (
                                              entry.precisionValue || '-'
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Input
                                                type="number"
                                                value={editValues.scale || ''}
                                                onChange={(e) => updateEditingValue(entry.dataDictionaryKey, 'scale', e.target.value ? parseInt(e.target.value) : null)}
                                                className="w-20"
                                              />
                                            ) : (
                                              entry.scale || '-'
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Select
                                                value={editValues.isPrimaryKey || 'N'}
                                                onValueChange={(value) => updateEditingValue(entry.dataDictionaryKey, 'isPrimaryKey', value)}
                                              >
                                                <SelectTrigger className="w-20">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="Y">Yes</SelectItem>
                                                  <SelectItem value="N">No</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Badge variant={entry.isPrimaryKey === 'Y' ? 'default' : 'secondary'}>
                                                {entry.isPrimaryKey === 'Y' ? 'Yes' : 'No'}
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Select
                                                value={editValues.isForeignKey || 'N'}
                                                onValueChange={(value) => updateEditingValue(entry.dataDictionaryKey, 'isForeignKey', value)}
                                              >
                                                <SelectTrigger className="w-20">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="Y">Yes</SelectItem>
                                                  <SelectItem value="N">No</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Badge variant={entry.isForeignKey === 'Y' ? 'default' : 'secondary'}>
                                                {entry.isForeignKey === 'Y' ? 'Yes' : 'No'}
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Select
                                                value={editValues.isNotNull || 'N'}
                                                onValueChange={(value) => updateEditingValue(entry.dataDictionaryKey, 'isNotNull', value)}
                                              >
                                                <SelectTrigger className="w-20">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="Y">Yes</SelectItem>
                                                  <SelectItem value="N">No</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Badge variant={entry.isNotNull === 'Y' ? 'default' : 'secondary'}>
                                                {entry.isNotNull === 'Y' ? 'Yes' : 'No'}
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell className="max-w-48">
                                            {isEditing ? (
                                              <Textarea
                                                value={editValues.columnDescription || ''}
                                                onChange={(e) => updateEditingValue(entry.dataDictionaryKey, 'columnDescription', e.target.value)}
                                                className="w-40 min-h-[60px]"
                                                placeholder="Column description..."
                                              />
                                            ) : (
                                              <div className="truncate" title={entry.columnDescription || ''}>
                                                {entry.columnDescription || '-'}
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDelete(entry.dataDictionaryKey)}
                                              data-testid={`button-delete-entry-${entry.dataDictionaryKey}`}
                                              className="text-red-600 hover:text-red-700"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {filteredTables.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No tables found matching your criteria</p>
                <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Entry
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}