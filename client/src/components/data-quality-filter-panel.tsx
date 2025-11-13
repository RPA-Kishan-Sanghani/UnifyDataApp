import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export interface DataQualityFilters {
  search: string;
  executionLayer: string;
  validationType: string;
  status: string;
  targetApplicationId: string;
}

interface DataQualityFilterPanelProps {
  filters: DataQualityFilters;
  onFiltersChange: (filters: DataQualityFilters) => void;
  onRefresh?: () => void;
}

export default function DataQualityFilterPanel({ 
  filters, 
  onFiltersChange, 
  onRefresh 
}: DataQualityFilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch target applications for dropdown
  const { data: applications = [] } = useQuery<Array<{ applicationId: number; applicationName: string }>>({
    queryKey: ['/api/data-dictionary/target-applications']
  });

  const handleReset = () => {
    const resetFilters: DataQualityFilters = {
      search: '',
      executionLayer: '',
      validationType: '',
      status: '',
      targetApplicationId: ''
    };
    onFiltersChange(resetFilters);
  };

  return (
    <div className={cn(
      "transition-all duration-300 ease-in-out",
      isCollapsed ? "w-12" : "w-64"
    )}>
      <Card className="h-fit">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded mr-1"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsCollapsed(!isCollapsed);
                  }
                }}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-3 w-3 -rotate-90" />
                ) : (
                  <ChevronUp className="h-3 w-3 rotate-90" />
                )}
              </div>
              <Filter className="h-4 w-4 mr-1" />
              <span className="text-sm font-semibold">
                {!isCollapsed && "Filters"}
              </span>
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
                      data-testid="button-refresh-data-quality"
                    >
                      Refresh
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {!isCollapsed && (
          <CardContent className="space-y-3">
            {/* Search */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Search</label>
              <Input
                placeholder="Search rules..." 
                className="text-sm"
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                data-testid="input-search-data-quality"
              />
            </div>

            {/* Target Application */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Target Application</label>
              <Select 
                value={filters.targetApplicationId || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, targetApplicationId: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-target-application">
                  <SelectValue placeholder="All Applications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Applications</SelectItem>
                  {applications.map((app) => (
                    <SelectItem key={app.applicationId} value={app.applicationId.toString()}>
                      {app.applicationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value="Bronze">Bronze</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Validation Type */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Validation Type</label>
              <Select 
                value={filters.validationType || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, validationType: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-validation-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="completeness">Completeness</SelectItem>
                  <SelectItem value="accuracy">Accuracy</SelectItem>
                  <SelectItem value="consistency">Consistency</SelectItem>
                  <SelectItem value="validity">Validity</SelectItem>
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}