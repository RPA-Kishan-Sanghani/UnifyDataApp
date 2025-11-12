import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  DataQualityConfig,
  InsertDataQualityConfig,
} from "@shared/schema";
import {
  Shield,
  Settings,
  Loader2,
  Save,
  X,
  Info,
} from "lucide-react";

// Form validation schema matching the database exactly
const dataQualityFormSchema = z.object({
  configKey: z.number().optional(),
  executionLayer: z.string().min(1, "Execution layer is required"),
  tableName: z.string().optional(), // Optional since derived from targetTableName
  attributeName: z.string().min(1, "Attribute name is required"),
  validationType: z.string().min(1, "Validation type is required"),
  referenceTableName: z.string().optional(),
  defaultValue: z.string().optional(),
  errorTableTransferFlag: z.string().min(1, "Transfer to error table is required"),
  thresholdPercentage: z.number().min(0, "Threshold percentage must be at least 0").max(100, "Threshold percentage must be at most 100"),
  activeFlag: z.string().min(1, "Active flag is required"),
  customQuery: z.string().optional(),
  // Source configuration fields
  sourceSystem: z.string().optional(),
  sourceConnectionId: z.number().optional(),
  sourceType: z.string().optional(),
  sourceSchema: z.string().optional(),
  sourceTableName: z.string().optional(),
  // Target configuration fields
  targetSystem: z.string().min(1, "Target system is required"),
  targetConnectionId: z.number().optional(),
  targetType: z.string().min(1, "Target type is required"),
  targetSchema: z.string().optional(),
  targetTableName: z.string().optional(),
}).refine((data) => {
  // Make customQuery required when validationType is "Custom Query Check"
  if (data.validationType === 'Custom Query Check') {
    return !!data.customQuery && data.customQuery.trim().length > 0;
  }
  return true;
}, {
  message: "Custom query is required for Custom Query Check validation type",
  path: ["customQuery"],
});

type FormData = z.infer<typeof dataQualityFormSchema>;

interface DataQualityFormProps {
  config?: DataQualityConfig | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DataQualityForm({
  config,
  onSuccess,
  onCancel,
}: DataQualityFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch metadata for dropdowns
  const { data: executionLayers = [] } = useQuery<string[]>({
    queryKey: ["/api/metadata/execution_layer"],
  });

  const { data: activeFlags = [] } = useQuery<string[]>({
    queryKey: ["/api/metadata/active_flag"],
  });

  // Fetch all available connections
  const { data: allConnections = [] } = useQuery<Array<{ connectionId: number; connectionName: string; connectionType: string; status: string }>>({
    queryKey: ["/api/connections"],
  });

  // Fetch available system types
  const { data: sourceSystems = [] } = useQuery<string[]>({
    queryKey: ["/api/metadata/source_system"],
  });

  const { data: sourceTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/metadata/source_type"],
  });

  // Validation types
  const validationTypes = [
    "Null Check",
    "List Value Check", 
    "Duplicate Check",
    "File Format Check",
    "Referential Integrity Check",
    "Custom Query Check"
  ];

  // Helper function to convert snake_case validation type back to display format
  const convertValidationTypeToDisplayFormat = (validationType: string) => {
    const typeMap: Record<string, string> = {
      'null_check': 'Null Check',
      'list_value_check': 'List Value Check',
      'duplicate_check': 'Duplicate Check',
      'file_format_check': 'File Format Check',
      'referential_integrity_check': 'Referential Integrity Check',
      'custom_query_check': 'Custom Query Check'
    };
    return typeMap[validationType.toLowerCase()] || validationType;
  };

  // Initialize form with default values or existing config values
  const form = useForm<FormData>({
    resolver: zodResolver(dataQualityFormSchema),
    defaultValues: {
      configKey: undefined,
      executionLayer: "",
      tableName: "",
      attributeName: "",
      validationType: "",
      referenceTableName: "",
      defaultValue: "",
      errorTableTransferFlag: "",
      thresholdPercentage: undefined,
      activeFlag: "",
      customQuery: "",
      // Source configuration
      sourceSystem: "",
      sourceConnectionId: undefined,
      sourceType: "",
      sourceSchema: "",
      sourceTableName: "",
      // Target configuration
      targetSystem: "",
      targetConnectionId: undefined,
      targetType: "",
      targetSchema: "",
      targetTableName: "",
    },
  });

  // Fetch the pipeline config to get source/target system info when editing
  const { data: pipelineConfig } = useQuery<any>({
    queryKey: ['/api/pipelines', config?.configKey],
    enabled: !!config?.configKey
  });

  // Update form values when config is loaded
  useEffect(() => {
    if (config) {
      form.reset({
        configKey: config.configKey || undefined,
        executionLayer: config.executionLayer ? 
          config.executionLayer.charAt(0).toUpperCase() + config.executionLayer.slice(1).toLowerCase() : 
          "",
        tableName: config.tableName || "",
        attributeName: config.attributeName || "",
        validationType: config.validationType ? convertValidationTypeToDisplayFormat(config.validationType) : "",
        referenceTableName: config.referenceTableName || "",
        defaultValue: config.defaultValue || "",
        errorTableTransferFlag: config.errorTableTransferFlag || "",
        thresholdPercentage: config.thresholdPercentage ?? undefined,
        activeFlag: config.activeFlag || "",
        customQuery: config.customQuery || "",
        // Source configuration from pipeline config if available
        sourceSystem: pipelineConfig?.sourceSystem ? 
          pipelineConfig.sourceSystem.charAt(0).toUpperCase() + pipelineConfig.sourceSystem.slice(1).toLowerCase() : 
          "",
        sourceConnectionId: pipelineConfig?.connectionId || undefined,
        sourceType: pipelineConfig?.sourceType ? 
          pipelineConfig.sourceType.charAt(0).toUpperCase() + pipelineConfig.sourceType.slice(1).toLowerCase() : 
          "",
        sourceSchema: pipelineConfig?.sourceSchemaName || "",
        sourceTableName: pipelineConfig?.sourceTableName || "",
        // Target configuration from pipeline config if available
        targetSystem: pipelineConfig?.targetSystem ? 
          pipelineConfig.targetSystem.charAt(0).toUpperCase() + pipelineConfig.targetSystem.slice(1).toLowerCase() : 
          "",
        targetConnectionId: pipelineConfig?.targetConnectionId || undefined,
        targetType: pipelineConfig?.targetType ? 
          pipelineConfig.targetType.charAt(0).toUpperCase() + pipelineConfig.targetType.slice(1).toLowerCase() : 
          "",
        targetSchema: pipelineConfig?.targetSchemaName || "",
        targetTableName: pipelineConfig?.targetTableName || "",
      });
    }
  }, [config, pipelineConfig, form]);



  // Basic Configuration - Target System, Connection, Schema, Table, Type
  const selectedTargetSystem = form.watch('targetSystem');
  const selectedTargetConnectionId = form.watch('targetConnectionId');
  const selectedTargetType = form.watch('targetType');
  const selectedTargetSchema = form.watch('targetSchema');
  const selectedTargetTableName = form.watch('targetTableName');

  // Filter connections by selected target system
  const targetConnections = allConnections.filter(
    (connection) => 
      !selectedTargetSystem || 
      connection.connectionType.toLowerCase() === selectedTargetSystem.toLowerCase()
  );

  // Fetch schemas for selected target connection
  const { data: targetSchemas = [] } = useQuery<string[]>({
    queryKey: ["/api/connections", selectedTargetConnectionId, "schemas"],
    enabled: !!selectedTargetConnectionId,
  });

  // Fetch tables for selected target connection and schema
  const { data: targetTables = [] } = useQuery<string[]>({
    queryKey: ["/api/connections", selectedTargetConnectionId, "schemas", selectedTargetSchema, "tables"],
    enabled: !!selectedTargetConnectionId && !!selectedTargetSchema,
  });

  // Fetch columns for selected target table
  const { data: targetColumns = [] } = useQuery<string[]>({
    queryKey: ["/api/connections", selectedTargetConnectionId, "schemas", selectedTargetSchema, "tables", selectedTargetTableName, "columns"],
    enabled: !!selectedTargetConnectionId && !!selectedTargetSchema && !!selectedTargetTableName,
  });


  // Watch the validation type to conditionally show fields
  const selectedValidationType = form.watch('validationType');
  const [showDefaultValue, setShowDefaultValue] = useState(false);

  const showReferenceTable = selectedValidationType === 'Referential Integrity Check' || 
                             selectedValidationType === 'List Value Check' ||
                             selectedValidationType === 'File Format Check';
  // Threshold percentage is now always visible
  const showThresholdPercentage = true;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertDataQualityConfig) => {
      console.log('Creating data quality config with data:', data);
      const response = await apiRequest("POST", "/api/data-quality-configs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-quality-configs"] });
      toast({
        title: "Success",
        description: "Data quality configuration created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Create mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create data quality configuration",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log('Updating data quality config with data:', data);
      const response = await apiRequest("PUT", `/api/data-quality-configs/${config?.dataQualityKey}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-quality-configs"] });
      toast({
        title: "Success", 
        description: "Data quality configuration updated successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Update mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update data quality configuration",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      console.log('Form submitted with data:', data);
      setIsLoading(true);

      // Helper function to convert validation type to snake_case
      const convertValidationTypeToSnakeCase = (validationType: string) => {
        return validationType
          .toLowerCase()
          .replace(/\s+/g, '_');
      };

      // Process the form data for submission
      const processedData = {
        ...data,
        // Convert execution layer to lowercase for database storage
        executionLayer: data.executionLayer?.toLowerCase(),
        // Convert validation type to snake_case for database storage
        validationType: data.validationType ? convertValidationTypeToSnakeCase(data.validationType) : data.validationType,
        // Set tableName to targetTableName if not explicitly set
        tableName: data.tableName || data.targetTableName,
        // Convert empty strings to undefined for optional fields
        configKey: data.configKey || undefined,
        referenceTableName: data.referenceTableName || undefined,
        // Set default value to 'NA' if empty
        defaultValue: data.defaultValue?.trim() || 'NA',
        thresholdPercentage: data.thresholdPercentage || undefined,
        customQuery: data.customQuery || undefined,
      };

      // Keep target fields for backend config_key matching, then remove before DB insert
      const dbData = {
        ...processedData,
        // Include target fields for backend matching
        targetSystem: data.targetSystem,
        targetConnectionId: data.targetConnectionId,
        targetType: data.targetType,
        targetSchema: data.targetSchema,
        targetTableName: data.targetTableName,
      };

      if (config) {
        console.log('Processed update data:', dbData);
        await updateMutation.mutateAsync(dbData);
      } else {
        console.log('Processed create data:', dbData);
        await createMutation.mutateAsync(dbData as any);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Configuration
            </CardTitle>
            <CardDescription>Configure the data quality validation settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="executionLayer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Execution Layer <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Processing layer for validation</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger data-testid="select-execution-layer">
                          <SelectValue placeholder="Select execution layer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {executionLayers.map((layer) => (
                          <SelectItem key={layer} value={layer}>{layer}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Validation Type <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Type of validation rule</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-validation-type">
                          <SelectValue placeholder="Select validation type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {validationTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Target System Field */}
              <FormField
                control={form.control}
                name="targetSystem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Target System <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>System type for target connection</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset dependent fields when target system changes
                        form.setValue('targetConnectionId', undefined);
                        form.setValue('targetSchema', '');
                        form.setValue('targetTableName', '');
                        form.setValue('attributeName', '');
                      }} 
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-target-system-basic">
                          <SelectValue placeholder="Select target system" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sourceSystems.map((system) => ( // Using sourceSystems here as they represent available system types
                          <SelectItem key={system} value={system}>{system}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Target Connection Field */}
              <FormField
                control={form.control}
                name="targetConnectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Target Database Connection
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Database connection for target system</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value ? parseInt(value) : undefined);
                        // Reset dependent fields when connection changes
                        form.setValue('targetSchema', '');
                        form.setValue('targetTableName', '');
                        form.setValue('attributeName', '');
                      }} 
                      value={field.value?.toString() || ''}
                      disabled={!selectedTargetSystem}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-target-connection-basic">
                          <SelectValue placeholder={selectedTargetSystem ? "Select connection" : "Select target system first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {targetConnections.map((connection) => (
                          <SelectItem key={connection.connectionId} value={connection.connectionId.toString()}>
                            {connection.connectionName} ({connection.connectionType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Target Type Field */}
              <FormField
                control={form.control}
                name="targetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Target Type <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Defines whether the target is a database table or a file</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset dependent fields when type changes
                        form.setValue('targetSchema', '');
                        form.setValue('targetTableName', '');
                        form.setValue('attributeName', '');
                      }} 
                      value={field.value || ''}
                      disabled={!selectedTargetConnectionId}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-target-type-basic">
                          <SelectValue placeholder={selectedTargetConnectionId ? "Select target type" : "Select connection first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Table">Table</SelectItem>
                        <SelectItem value="File">File</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show schema and table fields only when target type is Table */}
              {selectedTargetType === 'Table' && (
                <>
                  {/* Target Schema Field */}
                  <FormField
                    control={form.control}
                    name="targetSchema"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Target Schema
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Database schema containing the target table</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value || '');
                            // Reset dependent fields when schema changes
                            form.setValue('targetTableName', '');
                            form.setValue('attributeName', '');
                          }} 
                          value={field.value || ''}
                          disabled={!selectedTargetConnectionId}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-target-schema-basic">
                              <SelectValue placeholder={selectedTargetConnectionId ? "Select schema" : "Select connection first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {targetSchemas.map((schema) => (
                              <SelectItem key={schema} value={schema}>{schema}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Target Table Field */}
                  <FormField
                    control={form.control}
                    name="targetTableName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Target Table Name
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Table to validate</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value || '');
                            // Reset attribute name when table changes
                            form.setValue('attributeName', '');
                          }} 
                          value={field.value || ''}
                          disabled={!selectedTargetConnectionId || !selectedTargetSchema}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-target-table-basic">
                              <SelectValue placeholder={selectedTargetConnectionId && selectedTargetSchema ? "Select table" : "Select schema first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {targetTables.map((table) => (
                              <SelectItem key={table} value={table}>{table}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Show file fields only when target type is File */}
              {selectedTargetType === 'File' && (
                <>
                  {/* Target File Name Field */}
                  <FormField
                    control={form.control}
                    name="targetTableName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Target File Name
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Name of the target file</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Enter target file name" 
                            data-testid="input-target-file-name"
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              // Reset attribute name when file name changes
                              form.setValue('attributeName', '');
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Target Object Field */}
                  <FormField
                    control={form.control}
                    name="targetSchema"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Target Object
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Target object identifier or path</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Enter target object" 
                            data-testid="input-target-object"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Attribute Name Field - Dropdown for Table type, Input for File type */}
              <FormField
                control={form.control}
                name="attributeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Attribute Name <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Column(s) or field(s) to validate</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    {selectedTargetType === 'Table' ? (
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                        disabled={!selectedTargetTableName}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-attribute-name-basic">
                            <SelectValue placeholder={selectedTargetTableName ? "Select column" : "Select table first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {targetColumns.map((column) => (
                            <SelectItem key={column} value={column}>{column}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter attribute name" 
                          data-testid="input-attribute-name-basic"
                          disabled={!selectedTargetTableName}
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Validation Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Validation Configuration
            </CardTitle>
            <CardDescription>Additional settings for data validation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {showReferenceTable && (
                <FormField
                  control={form.control}
                  name="referenceTableName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Reference Table Name
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reference table for lookups</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter reference table name" data-testid="input-reference-table" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-default-value"
                    checked={showDefaultValue}
                    onCheckedChange={(checked) => {
                      setShowDefaultValue(checked as boolean);
                      if (!checked) {
                        form.setValue('defaultValue', '');
                      }
                    }}
                    data-testid="checkbox-show-default-value"
                  />
                  <label
                    htmlFor="show-default-value"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Do you want to replace null value to default value?
                  </label>
                </div>
              </div>

              {showThresholdPercentage && (
                <FormField
                  control={form.control}
                  name="thresholdPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Threshold Percentage <span className="text-red-500">*</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Maximum allowed error percentage</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Enter threshold percentage"
                          data-testid="input-threshold-percentage"
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {showDefaultValue && (
                <FormField
                  control={form.control}
                  name="defaultValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Default Value
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Default value for replacement</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter default value" data-testid="input-default-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="errorTableTransferFlag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Transfer to Error Table <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Flag to transfer errors to error table</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger data-testid="select-error-transfer">
                          <SelectValue placeholder="Select transfer option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Y">Yes</SelectItem>
                        <SelectItem value="N">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="activeFlag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Active Flag <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Active indicator</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger data-testid="select-active-flag">
                          <SelectValue placeholder="Select active flag" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Y">Y</SelectItem>
                        <SelectItem value="N">N</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedValidationType === 'Custom Query Check' && (
              <FormField
                control={form.control}
                name="customQuery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Custom Query <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Custom validation SQL</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter custom SQL query for validation"
                        rows={3}
                        data-testid="textarea-custom-query"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-2 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-quality"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isLoading || createMutation.isPending || updateMutation.isPending}
            data-testid="button-save-quality"
          >
            {isLoading || createMutation.isPending || updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {config ? "Update Configuration" : "Save Configuration"}
          </Button>
        </div>
      </form>
    </Form>
  );
}