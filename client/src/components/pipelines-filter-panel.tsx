import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationConfig } from "@shared/schema";

export interface PipelineFilters {
  search: string;
  executionLayer: string;
  applicationName: string;
  status: string;
}

interface PipelinesFilterPanelProps {
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
  onRefresh?: () => void;
}

export default function PipelinesFilterPanel({ 
  filters, 
  onFiltersChange, 
  onRefresh 
}: PipelinesFilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch application configs for dropdown
  const { data: applicationConfigs = [] } = useQuery<ApplicationConfig[]>({
    queryKey: ['/api/application-configs', { status: 'Active' }],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/application-configs?status=Active', { headers });
      if (!response.ok) {
        return [] as ApplicationConfig[];
      }
      return await response.json() as ApplicationConfig[];
    }
  });

  const handleReset = () => {
    const resetFilters: PipelineFilters = {
      search: '',
      executionLayer: '',
      applicationName: '',
      status: ''
    };
    onFiltersChange(resetFilters);
  };

  return (
    <div className={cn(
      "transition-all duration-300 ease-in-out",
      isCollapsed ? "w-12" : "w-64"
    )}>
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-xs px-2 py-1 h-7 mr-1"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-3 w-3 -rotate-90" />
                ) : (
                  <ChevronUp className="h-3 w-3 rotate-90" />
                )}
              </Button>
              <Filter className="h-4 w-4 mr-1" />
              {!isCollapsed && "Filters"}
            </div>
            <div className="flex items-center space-x-1">
              {!isCollapsed && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs px-2 py-1 h-7"
                    data-testid="button-reset-filters"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  {onRefresh && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onRefresh}
                      className="text-xs px-2 py-1 h-7 bg-blue-600 hover:bg-blue-700"
                      data-testid="button-refresh-pipelines"
                    >
                      Refresh
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="space-y-3">
            {/* Search */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Search</label>
              <Input
                placeholder="Search pipelines..." 
                className="text-sm"
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                data-testid="input-search-pipelines"
              />
            </div>

            {/* Execution Layer */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Execution Layer</label>
              <Select 
                value={filters.executionLayer || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, executionLayer: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-execution-layer">
                  <SelectValue placeholder="All Layers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Layers</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Application Name */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Application Name</label>
              <Select 
                value={filters.applicationName || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, applicationName: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-application-name">
                  <SelectValue placeholder="All Applications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Applications</SelectItem>
                  {applicationConfigs.map((app) => (
                    <SelectItem key={app.applicationId} value={app.applicationName || ''}>
                      {app.applicationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
              <Select 
                value={filters.status || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, status: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Y">Active</SelectItem>
                  <SelectItem value="N">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}