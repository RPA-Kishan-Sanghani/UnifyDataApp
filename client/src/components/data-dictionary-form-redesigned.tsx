import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, X, MoreVertical, Loader2, Edit, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const dataDictionarySchema = z.object({
  executionLayer: z.string().min(1, "Execution layer is required"),
  sourceSystem: z.string().min(1, "Source system is required"),
  sourceConnectionId: z.number().min(1, "Source connection is required"),
  sourceType: z.string().min(1, "Source type is required"),
  sourceSchemaName: z.string().min(1, "Source schema is required"),
  sourceTableName: z.string().min(1, "Source object is required"),
  sourceFileName: z.string().optional(),
  targetSystem: z.string().min(1, "Target system is required"),
  targetConnectionId: z.number().min(1, "Target connection is required"),
  targetLayer: z.string().min(1, "Target layer is required"),
  targetType: z.string().min(1, "Target type is required"),
  targetSchemaName: z.string().min(1, "Target schema is required"),
  targetTableName: z.string().min(1, "Target object is required"),
  targetFileName: z.string().optional(),
});

interface ColumnMetadata {
  attributeName: string;
  dataType: string;
  precision: number | undefined;
  length: number | undefined;
  scale: number | undefined;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  columnDescription?: string; // Optional - only field that's not mandatory
  isNotNull: boolean;
}

interface DataDictionaryFormRedesignedProps {
  entry?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DataDictionaryFormRedesigned({ entry, onSuccess, onCancel }: DataDictionaryFormRedesignedProps) {
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [newTargetObject, setNewTargetObject] = useState("");
  const [showAddTargetObject, setShowAddTargetObject] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof dataDictionarySchema>>({
    resolver: zodResolver(dataDictionarySchema),
    defaultValues: {
      executionLayer: entry?.executionLayer || "",
      sourceSystem: "",
      sourceConnectionId: entry?.configKey || 0,
      sourceType: "",
      sourceSchemaName: entry?.schemaName || "",
      sourceTableName: entry?.tableName || "",
      sourceFileName: "",
      targetSystem: "",
      targetConnectionId: entry?.configKey || 0,
      targetLayer: "",
      targetType: "",
      targetSchemaName: "",
      targetTableName: "",
      targetFileName: "",
    },
  });

  // Watch form values for cascading dropdowns
  const watchedValues = form.watch();

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch source and target types
  const { data: sourceTypes = [] } = useQuery({
    queryKey: ['/api/metadata/source_type'],
    queryFn: async () => {
      const response = await fetch('/api/metadata/source_type', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    }
  });

  // Fetch execution layers
  const { data: executionLayers = [] } = useQuery({
    queryKey: ['/api/metadata/execution_layer'],
    queryFn: async () => {
      const response = await fetch('/api/metadata/execution_layer', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    }
  });

  // Fetch source systems
  const { data: sourceSystems = [] } = useQuery({
    queryKey: ['/api/metadata/source_system'],
    queryFn: async () => {
      const response = await fetch('/api/metadata/source_system', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    }
  });

  // Fetch all connections
  const { data: allConnections = [] } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => {
      const response = await fetch('/api/connections', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as any[];
    }
  });

  // Populate form with existing entry data when editing (simple direct editing - no fetching from config/connections)
  useEffect(() => {
    if (entry) {
      // Just use the data from the data dictionary entry itself
      // Capitalize execution layer for display
      const capitalizeLayer = (layer: string) => 
        layer ? layer.charAt(0).toUpperCase() + layer.slice(1).toLowerCase() : "";
      
      // Set basic fields from entry
      form.setValue('executionLayer', capitalizeLayer(entry.executionLayer || ""));
      form.setValue('sourceSchemaName', entry.schemaName || "");
      form.setValue('sourceTableName', entry.tableName || "");
      
      // Set default values for fields that aren't in data dictionary table
      form.setValue('sourceSystem', "");
      form.setValue('sourceConnectionId', 0);
      form.setValue('sourceType', "Table");
      form.setValue('sourceFileName', "");
      
      form.setValue('targetSystem', "");
      form.setValue('targetConnectionId', 0);
      form.setValue('targetLayer', capitalizeLayer(entry.executionLayer || ""));
      form.setValue('targetType', "Table");
      form.setValue('targetSchemaName', entry.schemaName || "");
      form.setValue('targetTableName', entry.tableName || "");
      form.setValue('targetFileName', "");
      
      // Fetch and populate column metadata from existing data dictionary entries for this table
      const fetchColumns = async () => {
        try {
          const dictResponse = await fetch('/api/data-dictionary', { headers: getAuthHeaders() });
          if (dictResponse.ok) {
            const allEntries = await dictResponse.json();
            const tableColumns = allEntries
              .filter((e: any) => 
                e.schemaName === entry.schemaName && 
                e.tableName === entry.tableName
              )
              .map((e: any) => ({
                attributeName: e.attributeName || '',
                dataType: e.dataType || '',
                precision: e.precisionValue || undefined,
                length: e.length || undefined,
                scale: e.scale || undefined,
                isPrimaryKey: e.isPrimaryKey === 'Y',
                isForeignKey: e.isForeignKey === 'Y',
                foreignKeyTable: undefined,
                columnDescription: e.columnDescription || '',
                isNotNull: e.isNotNull === 'Y'
              }));
            
            if (tableColumns.length > 0) {
              setColumns(tableColumns);
            }
          }
        } catch (error) {
          console.error('Error fetching columns:', error);
        }
      };
      
      fetchColumns();
    }
  }, [entry, form]);

  // Filter connections based on selected source system
  const sourceConnections = allConnections.filter(conn =>
    !watchedValues.sourceSystem ||
    conn.connectionType?.toLowerCase() === watchedValues.sourceSystem.toLowerCase() ||
    (watchedValues.sourceSystem === 'SQL Server' && conn.connectionType === 'SQL Server') ||
    (watchedValues.sourceSystem === 'MySQL' && conn.connectionType === 'MySQL') ||
    (watchedValues.sourceSystem === 'PostgreSQL' && conn.connectionType === 'PostgreSQL') ||
    (watchedValues.sourceSystem === 'Oracle' && conn.connectionType === 'Oracle') ||
    (watchedValues.sourceSystem === 'Snowflake' && conn.connectionType === 'Snowflake') ||
    (watchedValues.sourceSystem === 'MongoDB' && conn.connectionType === 'MongoDB') ||
    (watchedValues.sourceSystem === 'BigQuery' && conn.connectionType === 'GCP') ||
    (watchedValues.sourceSystem === 'Salesforce' && conn.connectionType === 'API')
  );

  // Filter target connections based on selected target system
  const targetConnections = allConnections.filter(conn =>
    !watchedValues.targetSystem ||
    conn.connectionType?.toLowerCase() === watchedValues.targetSystem.toLowerCase() ||
    (watchedValues.targetSystem === 'SQL Server' && conn.connectionType === 'SQL Server') ||
    (watchedValues.targetSystem === 'MySQL' && conn.connectionType === 'MySQL') ||
    (watchedValues.targetSystem === 'PostgreSQL' && conn.connectionType === 'PostgreSQL') ||
    (watchedValues.targetSystem === 'Oracle' && conn.connectionType === 'Oracle') ||
    (watchedValues.targetSystem === 'Snowflake' && conn.connectionType === 'Snowflake') ||
    (watchedValues.targetSystem === 'MongoDB' && conn.connectionType === 'MongoDB') ||
    (watchedValues.targetSystem === 'BigQuery' && conn.connectionType === 'GCP') ||
    (watchedValues.targetSystem === 'Salesforce' && conn.connectionType === 'API')
  );

  // Fetch source schemas
  const { data: sourceSchemas = [] } = useQuery({
    queryKey: ['/api/connections', watchedValues.sourceConnectionId, 'schemas'],
    queryFn: async () => {
      if (!watchedValues.sourceConnectionId) return [];
      const response = await fetch(`/api/connections/${watchedValues.sourceConnectionId}/schemas`, { 
        headers: getAuthHeaders() 
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    },
    enabled: !!watchedValues.sourceConnectionId
  });

  // Fetch source objects (tables)
  const { data: sourceObjects = [] } = useQuery({
    queryKey: ['/api/connections', watchedValues.sourceConnectionId, 'schemas', watchedValues.sourceSchemaName, 'tables'],
    queryFn: async () => {
      if (!watchedValues.sourceConnectionId || !watchedValues.sourceSchemaName) return [];
      const response = await fetch(`/api/connections/${watchedValues.sourceConnectionId}/schemas/${watchedValues.sourceSchemaName}/tables`, { 
        headers: getAuthHeaders() 
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    },
    enabled: !!watchedValues.sourceConnectionId && !!watchedValues.sourceSchemaName
  });

  // Fetch target schemas
  const { data: targetSchemas = [] } = useQuery({
    queryKey: ['/api/connections', watchedValues.targetConnectionId, 'schemas'],
    queryFn: async () => {
      if (!watchedValues.targetConnectionId) return [];
      const response = await fetch(`/api/connections/${watchedValues.targetConnectionId}/schemas`, { 
        headers: getAuthHeaders() 
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    },
    enabled: !!watchedValues.targetConnectionId
  });

  // Fetch target objects (tables)
  const { data: targetObjects = [] } = useQuery({
    queryKey: ['/api/connections', watchedValues.targetConnectionId, 'schemas', watchedValues.targetSchemaName, 'tables'],
    queryFn: async () => {
      if (!watchedValues.targetConnectionId || !watchedValues.targetSchemaName) return [];
      const response = await fetch(`/api/connections/${watchedValues.targetConnectionId}/schemas/${watchedValues.targetSchemaName}/tables`, { 
        headers: getAuthHeaders() 
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json() as string[];
    },
    enabled: !!watchedValues.targetConnectionId && !!watchedValues.targetSchemaName
  });

  // Auto-fetch metadata when target object is selected (only for Table type)
  useEffect(() => {
    const fetchColumnMetadata = async () => {
      // Only auto-fetch for Table type
      if (watchedValues.targetType !== 'Table') {
        // For File type, allow manual column entry
        if (watchedValues.targetType === 'File') {
          // Don't clear columns - allow user to add manually
          return;
        }
        setColumns([]);
        return;
      }

      if (!watchedValues.targetConnectionId || !watchedValues.targetSchemaName || !watchedValues.targetTableName) {
        setColumns([]);
        return;
      }

      setIsLoadingMetadata(true);
      try {
        const response = await fetch(
          `/api/connections/${watchedValues.targetConnectionId}/schemas/${watchedValues.targetSchemaName}/tables/${watchedValues.targetTableName}/metadata`,
          { headers: getAuthHeaders() }
        );
        if (!response.ok) throw new Error('Network response was not ok');
        const metadata = await response.json() as ColumnMetadata[];

        // Use the real metadata from the database
        setColumns(metadata);
      } catch (error) {
        console.error('Error fetching column metadata:', error);
        toast({
          title: "Error",
          description: "Failed to fetch column metadata",
          variant: "destructive",
        });
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchColumnMetadata();
  }, [watchedValues.targetType, watchedValues.targetConnectionId, watchedValues.targetSchemaName, watchedValues.targetTableName, toast]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dataDictionarySchema>) => {
      if (entry) {
        // EDITING MODE: Update/create entries for ALL columns shown in the table
        const schemaName = (data.targetSchemaName || data.sourceSchemaName || '').substring(0, 100);
        const tableName = (data.targetTableName || data.sourceTableName || '').substring(0, 100);
        
        // If no columns are loaded, fall back to updating just the original entry
        if (columns.length === 0) {
          const entryData = {
            configKey: entry.configKey || 1,
            executionLayer: (data.executionLayer || '').toLowerCase().substring(0, 50),
            schemaName,
            tableName,
            attributeName: (entry.attributeName || '').substring(0, 100),
            dataType: (entry.dataType || '').substring(0, 50),
            length: entry.length || null,
            precisionValue: entry.precisionValue || null,
            scale: entry.scale || null,
            isNotNull: entry.isNotNull || 'N',
            isPrimaryKey: entry.isPrimaryKey || 'N',
            isForeignKey: entry.isForeignKey || 'N',
            columnDescription: (entry.columnDescription || '').substring(0, 150),
            activeFlag: entry.activeFlag || 'Y',
            createdBy: entry.createdBy || 'User',
            updatedBy: 'User',
            // Include source and target fields for config_key matching
            sourceSystem: data.sourceSystem,
            sourceType: data.sourceType,
            sourceSchemaName: data.sourceSchemaName,
            sourceTableName: data.sourceTableName,
            targetSystem: data.targetSystem,
            targetType: data.targetType,
            targetSchemaName: data.targetSchemaName,
            targetTableName: data.targetTableName,
          };

          const response = await fetch(`/api/data-dictionary/${entry.dataDictionaryKey}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(entryData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update entry');
          }

          return response.json();
        }
        
        // Fetch all existing data dictionary entries for this table
        const existingEntriesResponse = await fetch('/api/data-dictionary', { headers: getAuthHeaders() });
        if (!existingEntriesResponse.ok) {
          throw new Error('Failed to fetch existing entries');
        }
        const allEntries = await existingEntriesResponse.json();
        
        // Filter entries for the same table
        const tableEntries = allEntries.filter((e: any) => 
          e.schemaName === schemaName && e.tableName === tableName
        );
        
        // Update or create entries for each column
        const promises = columns.map(async (column) => {
          // Find existing entry for this column
          const existingEntry = tableEntries.find((e: any) => 
            e.attributeName === column.attributeName
          );
          
          const entryData = {
            configKey: existingEntry?.configKey || entry.configKey || 1,
            executionLayer: (data.executionLayer || '').toLowerCase().substring(0, 50),
            schemaName,
            tableName,
            attributeName: (column.attributeName || '').substring(0, 100),
            dataType: (column.dataType || '').substring(0, 50),
            length: column.length || null,
            precisionValue: column.precision || null,
            scale: column.scale || null,
            isNotNull: column.isNotNull ? 'Y' : 'N',
            isPrimaryKey: column.isPrimaryKey ? 'Y' : 'N',
            isForeignKey: column.isForeignKey ? 'Y' : 'N',
            columnDescription: (column.columnDescription || '').substring(0, 150),
            activeFlag: existingEntry?.activeFlag || 'Y',
            createdBy: existingEntry?.createdBy || 'User',
            updatedBy: 'User',
            // Include source and target fields for config_key matching
            sourceSystem: data.sourceSystem,
            sourceType: data.sourceType,
            sourceSchemaName: data.sourceSchemaName,
            sourceTableName: data.sourceTableName,
            targetSystem: data.targetSystem,
            targetType: data.targetType,
            targetSchemaName: data.targetSchemaName,
            targetTableName: data.targetTableName,
          };
          
          if (existingEntry) {
            // Update existing entry
            const response = await fetch(`/api/data-dictionary/${existingEntry.dataDictionaryKey}`, {
              method: 'PUT',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(entryData),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to update entry');
            }
            
            return response.json();
          } else {
            // Create new entry
            const response = await fetch('/api/data-dictionary', {
              method: 'POST',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(entryData),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create entry');
            }
            
            return response.json();
          }
        });

        return Promise.all(promises);
      } else {
        // CREATION MODE: Create new entries for each column
        const promises = columns.map(column => {
          const entryData = {
            configKey: 1,
            executionLayer: (data.executionLayer || '').toLowerCase().substring(0, 50),
            schemaName: (data.targetSchemaName || '').substring(0, 100),
            tableName: (data.targetTableName || '').substring(0, 100),
            attributeName: (column.attributeName || '').substring(0, 100),
            dataType: (column.dataType || '').substring(0, 50),
            length: column.length || null,
            precisionValue: column.precision || null,
            scale: column.scale || null,
            isNotNull: column.isNotNull ? 'Y' : 'N',
            isPrimaryKey: column.isPrimaryKey ? 'Y' : 'N',
            isForeignKey: column.isForeignKey ? 'Y' : 'N',
            columnDescription: (column.columnDescription || '').substring(0, 150),
            activeFlag: 'Y',
            createdBy: 'User',
            updatedBy: 'User',
            // Include source and target fields for config_key matching
            sourceSystem: data.sourceSystem,
            sourceType: data.sourceType,
            sourceSchemaName: data.sourceSchemaName,
            sourceTableName: data.sourceTableName,
            targetSystem: data.targetSystem,
            targetType: data.targetType,
            targetSchemaName: data.targetSchemaName,
            targetTableName: data.targetTableName,
          };

          return fetch('/api/data-dictionary', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(entryData),
          }).then(async (response) => {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to save entry');
            }
            return response.json();
          });
        });

        return Promise.all(promises);
      }
    },
    onSuccess: () => {
      // Invalidate all data dictionary related queries
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });
      queryClient.invalidateQueries();
      toast({
        title: "Success",
        description: `Data dictionary ${entry ? 'updated' : 'created'} successfully`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${entry ? 'update' : 'create'} data dictionary: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateColumn = (index: number, field: keyof ColumnMetadata, value: any) => {
    setColumns(prev => prev.map((col, i) => {
      if (i === index) {
        const updatedCol = { ...col, [field]: value };
        
        // Auto-set length to 0 for date/timestamp data types
        if (field === 'dataType' && typeof value === 'string') {
          const dataTypeLower = value.toLowerCase();
          if (dataTypeLower === 'date' || dataTypeLower === 'timestamp' || 
              dataTypeLower.includes('timestamp') || dataTypeLower.includes('datetime')) {
            updatedCol.length = 0;
          }
        }
        
        return updatedCol;
      }
      return col;
    }));
  };


  const onSubmit = (data: z.infer<typeof dataDictionarySchema>) => {
    // Validate that all columns have required fields filled (all fields except columnDescription)
    // Note: precision, scale, and length can be 0 (valid), but not null/undefined
    const invalidColumns = columns.filter(col => 
      !col.attributeName || 
      !col.dataType || 
      col.precision === null || col.precision === undefined || 
      col.length === null || col.length === undefined || 
      col.scale === null || col.scale === undefined || 
      col.isPrimaryKey === undefined || 
      col.isForeignKey === undefined || 
      col.isNotNull === undefined
    );

    if (invalidColumns.length > 0) {
      toast({
        title: "Validation Error",
        description: "All column fields except 'Column Description' are mandatory. Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (columns.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one column to the metadata.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(data);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Top Section - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[500px]">
          {/* Left Column - Source */}
          <Card className="shadow-lg w-full max-w-none">
            <CardHeader className="bg-blue-50 dark:bg-blue-950 py-3">
              <CardTitle className="text-blue-700 dark:text-blue-300 text-sm">🔹 Source Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {/* Select Layer */}
              <div className="space-y-2">
                <Label htmlFor="execution-layer" className="flex items-center gap-2">
                  Select Layer
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Processing layer where this table belongs (Bronze, Silver, Gold).</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={watchedValues.executionLayer}
                  onValueChange={(value) => form.setValue('executionLayer', value)}
                >
                  <SelectTrigger data-testid="select-execution-layer">
                    <SelectValue placeholder="Select execution layer" />
                  </SelectTrigger>
                  <SelectContent>
                    {executionLayers.map((layer) => (
                      <SelectItem key={layer} value={layer}>{layer}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source System */}
              <div className="space-y-2">
                <Label htmlFor="source-system">Source System</Label>
                <Select
                  value={watchedValues.sourceSystem}
                  onValueChange={(value) => {
                    form.setValue('sourceSystem', value);
                    form.setValue('sourceConnectionId', 0); // Reset connection when system changes
                    // Reset dependent fields
                    form.setValue('sourceSchemaName', '');
                    form.setValue('sourceTableName', '');
                  }}
                >
                  <SelectTrigger data-testid="select-source-system">
                    <SelectValue placeholder="Select source system" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSystems.map((system) => (
                      <SelectItem key={system} value={system}>{system}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data Connection */}
              <div className="space-y-2">
                <Label htmlFor="source-connection">Data Connection</Label>
                <Select
                  value={watchedValues.sourceConnectionId?.toString() || ""}
                  onValueChange={(value) => {
                    form.setValue('sourceConnectionId', parseInt(value));
                    // Reset dependent fields when connection changes
                    form.setValue('sourceSchemaName', '');
                    form.setValue('sourceTableName', '');
                  }}
                  disabled={!watchedValues.sourceSystem}
                >
                  <SelectTrigger data-testid="select-source-connection">
                    <SelectValue placeholder={watchedValues.sourceSystem ? "Select source connection" : "Select source system first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceConnections.map((conn) => (
                      <SelectItem key={conn.connectionId} value={conn.connectionId.toString()}>
                        {conn.connectionName} ({conn.connectionType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source Type */}
              <div className="space-y-2">
                <Label htmlFor="source-type" className="flex items-center gap-2">
                  Source Type
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Type of source: Table or File</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={watchedValues.sourceType}
                  onValueChange={(value) => {
                    form.setValue('sourceType', value);
                    // Reset dependent fields when type changes
                    form.setValue('sourceSchemaName', '');
                    form.setValue('sourceTableName', '');
                    form.setValue('sourceFileName', '');
                  }}
                >
                  <SelectTrigger data-testid="select-source-type">
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Table">Table</SelectItem>
                    <SelectItem value="File">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Schema - Only for Table type */}
              {watchedValues.sourceType === 'Table' && (
                <div className="space-y-2">
                  <Label htmlFor="source-schema" className="flex items-center gap-2">
                    Source Schema
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the database schema.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={watchedValues.sourceSchemaName}
                    onValueChange={(value) => form.setValue('sourceSchemaName', value)}
                  >
                    <SelectTrigger data-testid="select-source-schema">
                      <SelectValue placeholder="Select source schema" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceSchemas.map((schema) => (
                        <SelectItem key={schema} value={schema}>{schema}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Source Object - For Table type */}
              {watchedValues.sourceType === 'Table' && (
                <div className="space-y-2">
                  <Label htmlFor="source-object" className="flex items-center gap-2">
                    Source Object
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the database table.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={watchedValues.sourceTableName}
                    onValueChange={(value) => form.setValue('sourceTableName', value)}
                  >
                    <SelectTrigger data-testid="select-source-object">
                      <SelectValue placeholder="Select source object" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceObjects.map((object) => (
                        <SelectItem key={object} value={object}>{object}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Source File Name - For File type */}
              {watchedValues.sourceType === 'File' && (
                <div className="space-y-2">
                  <Label htmlFor="source-file-name" className="flex items-center gap-2">
                    Source File Name
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the source file.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    value={watchedValues.sourceFileName || ''}
                    onChange={(e) => form.setValue('sourceFileName', e.target.value)}
                    placeholder="Enter source file name"
                    data-testid="input-source-file-name"
                  />
                </div>
              )}

              {/* Source Object - For File type */}
              {watchedValues.sourceType === 'File' && (
                <div className="space-y-2">
                  <Label htmlFor="source-object-file" className="flex items-center gap-2">
                    Source Object
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Object name for the file.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    value={watchedValues.sourceTableName || ''}
                    onChange={(e) => form.setValue('sourceTableName', e.target.value)}
                    placeholder="Enter source object name"
                    data-testid="input-source-object-file"
                  />
                </div>
              )}

              
            </CardContent>
          </Card>



          {/* Right Column - Target */}
          <Card className="shadow-lg w-full max-w-none">
            <CardHeader className="bg-green-50 dark:bg-green-950 py-3">
              <CardTitle className="text-green-700 dark:text-green-300 text-sm">🔹 Target Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {/* Target System */}
              <div className="space-y-2">
                <Label htmlFor="target-system">Target System</Label>
                <Select
                  value={watchedValues.targetSystem}
                  onValueChange={(value) => {
                    form.setValue('targetSystem', value);
                    form.setValue('targetConnectionId', 0); // Reset connection when system changes
                    // Reset dependent fields
                    form.setValue('targetSchemaName', '');
                    form.setValue('targetTableName', '');
                  }}
                >
                  <SelectTrigger data-testid="select-target-system">
                    <SelectValue placeholder="Select target system" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSystems.map((system) => (
                      <SelectItem key={system} value={system}>{system}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Connection */}
              <div className="space-y-2">
                <Label htmlFor="target-connection">Target Connection</Label>
                <Select
                  value={watchedValues.targetConnectionId?.toString() || ""}
                  onValueChange={(value) => {
                    form.setValue('targetConnectionId', parseInt(value));
                    // Reset dependent fields when connection changes
                    form.setValue('targetSchemaName', '');
                    form.setValue('targetTableName', '');
                  }}
                  disabled={!watchedValues.targetSystem}
                >
                  <SelectTrigger data-testid="select-target-connection">
                    <SelectValue placeholder={watchedValues.targetSystem ? "Select target connection" : "Select target system first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetConnections.map((conn) => (
                      <SelectItem key={conn.connectionId} value={conn.connectionId.toString()}>
                        {conn.connectionName} ({conn.connectionType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Layer */}
              <div className="space-y-2">
                <Label htmlFor="target-layer">Target Layer</Label>
                <Select
                  value={watchedValues.targetLayer || ""}
                  onValueChange={(value) => form.setValue('targetLayer', value)}
                >
                  <SelectTrigger data-testid="select-target-layer">
                    <SelectValue placeholder="Select target layer" />
                  </SelectTrigger>
                  <SelectContent>
                    {executionLayers.map((layer) => (
                      <SelectItem key={layer} value={layer}>{layer}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Type */}
              <div className="space-y-2">
                <Label htmlFor="target-type" className="flex items-center gap-2">
                  Target Type
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Type of target: Table or File</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={watchedValues.targetType}
                  onValueChange={(value) => {
                    form.setValue('targetType', value);
                    // Reset dependent fields when type changes
                    form.setValue('targetSchemaName', '');
                    form.setValue('targetTableName', '');
                    form.setValue('targetFileName', '');
                  }}
                >
                  <SelectTrigger data-testid="select-target-type">
                    <SelectValue placeholder="Select target type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Table">Table</SelectItem>
                    <SelectItem value="File">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Schema - Only for Table type */}
              {watchedValues.targetType === 'Table' && (
                <div className="space-y-2">
                  <Label htmlFor="target-schema" className="flex items-center gap-2">
                    Target Schema
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the database schema.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={watchedValues.targetSchemaName}
                    onValueChange={(value) => form.setValue('targetSchemaName', value)}
                  >
                    <SelectTrigger data-testid="select-target-schema">
                      <SelectValue placeholder="Select target schema" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetSchemas.map((schema) => (
                        <SelectItem key={schema} value={schema}>{schema}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Target Object - For Table type */}
              {watchedValues.targetType === 'Table' && (
                <div className="space-y-2">
                  <Label htmlFor="target-object" className="flex items-center gap-2">
                    Target Object
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the database table.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  {showAddTargetObject ? (
                    <div className="flex space-x-2">
                      <Input
                        value={newTargetObject}
                        onChange={(e) => setNewTargetObject(e.target.value)}
                        placeholder="Enter new target object name"
                        data-testid="input-new-target-object"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newTargetObject.trim()) {
                            form.setValue('targetTableName', newTargetObject.trim());
                            setShowAddTargetObject(false);
                            setNewTargetObject("");
                          }
                        }}
                        data-testid="button-save-target-object"
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddTargetObject(false);
                          setNewTargetObject("");
                        }}
                        data-testid="button-cancel-target-object"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <Select
                        value={watchedValues.targetTableName}
                        onValueChange={(value) => form.setValue('targetTableName', value)}
                      >
                        <SelectTrigger data-testid="select-target-object">
                          <SelectValue placeholder="Select target object" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetObjects.map((object) => (
                            <SelectItem key={object} value={object}>{object}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddTargetObject(true)}
                        data-testid="button-add-target-object"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Target File Name - For File type */}
              {watchedValues.targetType === 'File' && (
                <div className="space-y-2">
                  <Label htmlFor="target-file-name" className="flex items-center gap-2">
                    Target File Name
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the target file.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    value={watchedValues.targetFileName || ''}
                    onChange={(e) => form.setValue('targetFileName', e.target.value)}
                    placeholder="Enter target file name"
                    data-testid="input-target-file-name"
                  />
                </div>
              )}

              {/* Target Object - For File type */}
              {watchedValues.targetType === 'File' && (
                <div className="space-y-2">
                  <Label htmlFor="target-object-file" className="flex items-center gap-2">
                    Target Object
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Object name for the file.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    value={watchedValues.targetTableName || ''}
                    onChange={(e) => form.setValue('targetTableName', e.target.value)}
                    placeholder="Enter target object name"
                    data-testid="input-target-object-file"
                  />
                </div>
              )}

              
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section - Metadata Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Column Metadata
              {isLoadingMetadata && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Fetching metadata...</span>
                </div>
              )}
              {/* Add Column button for File type */}
              {watchedValues.targetType === 'File' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newColumn: ColumnMetadata = {
                      attributeName: `column_${columns.length + 1}`,
                      dataType: "varchar",
                      precision: undefined,
                      length: 255,
                      scale: undefined,
                      isPrimaryKey: false,
                      isForeignKey: false,
                      foreignKeyTable: undefined,
                      columnDescription: "",
                      isNotNull: false,
                    };
                    setColumns(prev => [...prev, newColumn]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Column
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!watchedValues.targetTableName && watchedValues.targetType === 'Table' ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No target object selected</h3>
                <p className="text-gray-500">Select a target object above to view and manage column metadata</p>
              </div>
            ) : columns.length === 0 && !isLoadingMetadata ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No columns added</h3>
                <p className="text-gray-500">
                  {watchedValues.targetType === 'File' 
                    ? 'Click "Add Column" button above to manually add column metadata'
                    : 'The selected object doesn\'t have any columns or metadata couldn\'t be fetched'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Attribute Name <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Name of the column/field.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Data Type <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Data type of the column (e.g., VARCHAR, INT, DATE).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Precision <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total number of digits for numeric fields.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Length <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Maximum length allowed for the column (if applicable).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Scale <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Number of digits after the decimal point (for numeric fields).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Primary Key <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Marks column as part of the primary key (Y/N).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Foreign Key <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Marks column as a foreign key (Y/N).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Is Not Null <span className="text-red-500">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Marks if column cannot contain NULL values (Y/N).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>Foreign Key Table</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          Column Description
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Business-friendly description of the column.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((column, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <Input
                            value={column.attributeName}
                            onChange={(e) => updateColumn(index, 'attributeName', e.target.value)}
                            className={`font-medium border-0 p-1 focus:border focus:border-input focus:ring-2 focus:ring-ring focus:ring-offset-2 ${!column.attributeName ? 'border-red-300 bg-red-50' : ''}`}
                            data-testid={`input-attribute-name-${index}`}
                            required
                            placeholder="Required"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={column.dataType}
                            onChange={(e) => updateColumn(index, 'dataType', e.target.value)}
                            className={`w-24 ${!column.dataType ? 'border-red-300 bg-red-50' : ''}`}
                            data-testid={`input-data-type-${index}`}
                            required
                            placeholder="Required"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={column.precision !== undefined && column.precision !== null ? column.precision : ''}
                            onChange={(e) => updateColumn(index, 'precision', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
                            className={`w-20 ${column.precision === undefined || column.precision === null ? 'border-red-300 bg-red-50' : ''}`}
                            data-testid={`input-precision-${index}`}
                            required
                            placeholder="Required"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={column.length !== undefined && column.length !== null ? column.length : ''}
                            onChange={(e) => updateColumn(index, 'length', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
                            className={`w-20 ${column.length === undefined || column.length === null ? 'border-red-300 bg-red-50' : ''}`}
                            data-testid={`input-length-${index}`}
                            required
                            placeholder="Required"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={column.scale !== undefined && column.scale !== null ? column.scale : ''}
                            onChange={(e) => updateColumn(index, 'scale', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
                            className={`w-20 ${column.scale === undefined || column.scale === null ? 'border-red-300 bg-red-50' : ''}`}
                            data-testid={`input-scale-${index}`}
                            required
                            placeholder="Required"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={column.isPrimaryKey}
                            onCheckedChange={(checked) => updateColumn(index, 'isPrimaryKey', checked)}
                            data-testid={`switch-primary-key-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={column.isForeignKey}
                            onCheckedChange={(checked) => updateColumn(index, 'isForeignKey', checked)}
                            data-testid={`switch-foreign-key-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={column.isNotNull}
                            onCheckedChange={(checked) => updateColumn(index, 'isNotNull', checked)}
                            data-testid={`switch-not-null-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          {column.isForeignKey && (
                            <Select
                              value={column.foreignKeyTable || ""}
                              onValueChange={(value) => updateColumn(index, 'foreignKeyTable', value)}
                            >
                              <SelectTrigger className="w-32" data-testid={`select-foreign-table-${index}`}>
                                <SelectValue placeholder="Select table" />
                              </SelectTrigger>
                              <SelectContent>
                                {sourceObjects.map((table) => (
                                  <SelectItem key={table} value={table}>{table}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={column.columnDescription}
                            onChange={(e) => updateColumn(index, 'columnDescription', e.target.value)}
                            placeholder="Enter column description..."
                            className="min-h-[100px] w-64 resize-both"
                            maxLength={1000}
                            data-testid={`textarea-description-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" data-testid={`button-actions-${index}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => {
                                // Edit functionality - focus on the data type field for this row with a small delay
                                setTimeout(() => {
                                  const dataTypeInput = document.querySelector(`[data-testid="input-data-type-${index}"]`) as HTMLInputElement;
                                  if (dataTypeInput) {
                                    dataTypeInput.focus();
                                    dataTypeInput.select(); // Select the text for easy editing
                                  }
                                }, 100);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Column
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                // Add new column after this one
                                const newColumn: ColumnMetadata = {
                                  attributeName: `new_column_${columns.length + 1}`,
                                  dataType: "varchar",
                                  precision: undefined,
                                  length: undefined,
                                  scale: undefined,
                                  isPrimaryKey: false,
                                  isForeignKey: false,
                                  foreignKeyTable: undefined,
                                  columnDescription: "",
                                  isNotNull: false, // Default value for new column
                                };
                                setColumns(prev => [
                                  ...prev.slice(0, index + 1),
                                  newColumn,
                                  ...prev.slice(index + 1)
                                ]);

                                // Focus on the new column's attribute name field after a short delay
                                setTimeout(() => {
                                  const newColumnIndex = index + 1;
                                  const attributeNameInput = document.querySelector(`[data-testid="input-attribute-name-${newColumnIndex}"]`) as HTMLInputElement;
                                  if (attributeNameInput) {
                                    attributeNameInput.focus();
                                    attributeNameInput.select(); // Select the text for easy editing
                                  }
                                }, 100);
                              }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Column After
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this column?')) {
                                    setColumns(prev => prev.filter((_, i) => i !== index));
                                  }
                                }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Column
                              </DropdownMenuItem>
                              <div className="border-t my-1"></div>
                              <DropdownMenuItem onClick={() => {
                                // Clear the description and force re-render
                                updateColumn(index, 'columnDescription', '');
                                // Focus on the description textarea after clearing
                                setTimeout(() => {
                                  const descriptionTextarea = document.querySelector(`[data-testid="textarea-description-${index}"]`) as HTMLTextAreaElement;
                                  if (descriptionTextarea) {
                                    descriptionTextarea.focus();
                                  }
                                }, 100);
                              }}>
                                Clear Description
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateColumn(index, 'isPrimaryKey', false)}>
                                Remove Primary Key
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateColumn(index, 'isForeignKey', false)}>
                                Remove Foreign Key
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateColumn(index, 'isNotNull', false)}>
                                Set Nullable
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-form"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              saveMutation.isPending || 
              columns.length === 0 || 
              !watchedValues.executionLayer ||
              !watchedValues.sourceSystem ||
              !watchedValues.sourceConnectionId ||
              !watchedValues.sourceType ||
              !watchedValues.sourceSchemaName ||
              !watchedValues.sourceTableName ||
              !watchedValues.targetSystem ||
              !watchedValues.targetConnectionId ||
              !watchedValues.targetLayer ||
              !watchedValues.targetType ||
              !watchedValues.targetSchemaName ||
              !watchedValues.targetTableName ||
              columns.some(col => 
                !col.attributeName || 
                !col.dataType || 
                col.precision === undefined || 
                col.length === undefined || 
                col.scale === undefined || 
                col.isPrimaryKey === undefined || 
                col.isForeignKey === undefined || 
                col.isNotNull === undefined
              )
            }
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-save-form"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {entry ? "Update Entry" : "Save Configuration"}
              </>
            )}
          </Button>
        </div>
        </form>
      </div>
    </TooltipProvider>
  );
}