import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, X, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApplicationConfigSchema, type ApplicationConfig, type InsertApplicationConfig } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

const formSchema = insertApplicationConfigSchema.extend({
  applicationType: z.string().min(1, "Application Type is required"),
  applicationName: z.string().min(1, "Application Name is required").max(100, "Maximum 100 characters"),
  applicationOwner: z.string().optional(),
  applicationDescription: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ApplicationConfig() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApplicationConfig | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicationType: '',
      applicationName: '',
      applicationOwner: '',
      applicationDescription: '',
      department: '',
      status: 'Active',
    },
  });

  const filters = {
    search: searchQuery,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    applicationType: typeFilter !== 'all' ? typeFilter : undefined,
  };

  const { data: configs = [], isLoading } = useQuery<ApplicationConfig[]>({
    queryKey: ['/api/application-configs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('applicationType', typeFilter);

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/application-configs?${params}`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch application configs');
      return (await response.json()) as ApplicationConfig[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertApplicationConfig) => {
      return await apiRequest('POST', '/api/application-configs', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/application-configs'] });
      toast({
        title: "Success",
        description: "Application configuration created successfully.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create application configuration.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertApplicationConfig> }) => {
      return await apiRequest('PUT', `/api/application-configs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/application-configs'] });
      toast({
        title: "Success",
        description: "Application configuration updated successfully.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update application configuration.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/application-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/application-configs'] });
      toast({
        title: "Success",
        description: "Application configuration deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete application configuration.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.applicationId.toString(), data });
    } else {
      createMutation.mutate(data);
    }
  };

  const resetForm = () => {
    form.reset({
      applicationType: '',
      applicationName: '',
      applicationOwner: '',
      applicationDescription: '',
      department: '',
      status: 'Active',
    });
    setEditingConfig(null);
    setIsFormVisible(false);
  };

  const handleEdit = (config: ApplicationConfig) => {
    setEditingConfig(config);
    setIsFormVisible(true);
    form.reset({
      applicationType: config.applicationType || '',
      applicationName: config.applicationName || '',
      applicationOwner: config.applicationOwner || '',
      applicationDescription: config.applicationDescription || '',
      department: config.department || '',
      status: config.status || 'Active',
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this application configuration?')) {
      deleteMutation.mutate(id.toString());
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full max-w-full overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Application Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage source and target application metadata</p>
        </div>
        <Button 
          onClick={() => setIsFormVisible(!isFormVisible)} 
          data-testid="button-toggle-form"
        >
          {isFormVisible ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {isFormVisible ? 'Cancel' : 'New Application'}
        </Button>
      </div>

      {isFormVisible && (
        <Card>
          <CardHeader>
            <CardTitle>{editingConfig ? 'Edit Application' : 'Create New Application'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="applicationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-application-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Source">Source</SelectItem>
                            <SelectItem value="Target">Target</SelectItem>
                            <SelectItem value="Both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="applicationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="" 
                            data-testid="input-application-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="applicationOwner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Owner</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="" 
                            data-testid="input-application-owner"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="" 
                            data-testid="input-department"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="applicationDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="" 
                          rows={3}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    {editingConfig ? 'Update' : 'Create'} Application
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle>Application Configurations</CardTitle>
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Source">Source</SelectItem>
                  <SelectItem value="Target">Target</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No application configurations found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => {
                    const StatusIcon = config.status === 'Active' ? CheckCircle : XCircle;
                    return (
                      <TableRow key={config.applicationId} data-testid={`row-config-${config.applicationId}`}>
                        <TableCell className="font-medium" data-testid={`text-app-id-${config.applicationId}`}>
                          {config.applicationId}
                        </TableCell>
                        <TableCell data-testid={`text-app-name-${config.applicationId}`}>
                          {config.applicationName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-type-${config.applicationId}`}>
                            {config.applicationType}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-owner-${config.applicationId}`}>
                          {config.applicationOwner || '-'}
                        </TableCell>
                        <TableCell data-testid={`text-department-${config.applicationId}`}>
                          {config.department || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusIcon className={`h-4 w-4 ${config.status === 'Active' ? 'text-green-600' : 'text-red-600'}`} />
                            <span className={config.status === 'Active' ? 'text-green-600' : 'text-red-600'} data-testid={`text-status-${config.applicationId}`}>
                              {config.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-updated-${config.applicationId}`}>
                          {config.lastUpdated ? new Date(config.lastUpdated).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEdit(config)}
                              data-testid={`button-edit-${config.applicationId}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(config.applicationId)}
                              data-testid={`button-delete-${config.applicationId}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
