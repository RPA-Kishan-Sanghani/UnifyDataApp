import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export interface LineageFilters {
  globalSearch: string;
  sourceApplicationId: string;
  targetApplicationId: string;
  sourceSchema: string;
  targetSchema: string;
  sourceLayer: string;
  targetLayer: string;
  sourceTable: string;
  targetTable: string;
}

interface LineageFilterPanelProps {
  filters: LineageFilters;
  onFiltersChange: (filters: LineageFilters) => void;
  onRefresh?: () => void;
}

interface LineageFilterOptions {
  sourceApplications: Array<{ applicationId: number; applicationName: string }>;
  targetApplications: Array<{ applicationId: number; applicationName: string }>;
  sourceSchemas: string[];
  targetSchemas: string[];
  sourceLayers: string[];
  targetLayers: string[];
  sourceTables: string[];
  targetTables: string[];
}

export default function LineageFilterPanel({ 
  filters, 
  onFiltersChange, 
  onRefresh 
}: LineageFilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch filter options
  const { data: filterOptions } = useQuery<LineageFilterOptions>({
    queryKey: ['/api/lineage/filters']
  });

  const handleReset = () => {
    const resetFilters: LineageFilters = {
      globalSearch: '',
      sourceApplicationId: '',
      targetApplicationId: '',
      sourceSchema: '',
      targetSchema: '',
      sourceLayer: '',
      targetLayer: '',
      sourceTable: '',
      targetTable: ''
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
                      data-testid="button-refresh-lineage"
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
            {/* Global Search */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Global Search</label>
              <Input
                placeholder="Search tables, columns..." 
                className="text-sm"
                value={filters.globalSearch}
                onChange={(e) => onFiltersChange({ ...filters, globalSearch: e.target.value })}
                data-testid="input-global-search"
              />
            </div>

            {/* Source Application */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Source Application</label>
              <Select 
                value={filters.sourceApplicationId || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, sourceApplicationId: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-source-application">
                  <SelectValue placeholder="All Applications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Applications</SelectItem>
                  {filterOptions?.sourceApplications.map((app) => (
                    <SelectItem key={app.applicationId} value={app.applicationId.toString()}>
                      {app.applicationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Application */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Target Application</label>
              <Select 
                value={filters.targetApplicationId || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, targetApplicationId: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-target-application">
                  <SelectValue placeholder="All Applications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Applications</SelectItem>
                  {filterOptions?.targetApplications.map((app) => (
                    <SelectItem key={app.applicationId} value={app.applicationId.toString()}>
                      {app.applicationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Schema */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Source Schema</label>
              <Select 
                value={filters.sourceSchema || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, sourceSchema: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-source-schema">
                  <SelectValue placeholder="All Schemas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schemas</SelectItem>
                  {filterOptions?.sourceSchemas.map((schema) => (
                    <SelectItem key={schema} value={schema}>
                      {schema}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Schema */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Target Schema</label>
              <Select 
                value={filters.targetSchema || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, targetSchema: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-target-schema">
                  <SelectValue placeholder="All Schemas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schemas</SelectItem>
                  {filterOptions?.targetSchemas.map((schema) => (
                    <SelectItem key={schema} value={schema}>
                      {schema}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Layer */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Source Layer</label>
              <Select 
                value={filters.sourceLayer || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, sourceLayer: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-source-layer">
                  <SelectValue placeholder="All Layers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Layers</SelectItem>
                  {filterOptions?.sourceLayers.map((layer) => (
                    <SelectItem key={layer} value={layer}>
                      {layer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Layer */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Target Layer</label>
              <Select 
                value={filters.targetLayer || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, targetLayer: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-target-layer">
                  <SelectValue placeholder="All Layers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Layers</SelectItem>
                  {filterOptions?.targetLayers.map((layer) => (
                    <SelectItem key={layer} value={layer}>
                      {layer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Table */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Source Table</label>
              <Select 
                value={filters.sourceTable || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, sourceTable: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-source-table">
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {filterOptions?.sourceTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Table */}
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Target Table</label>
              <Select 
                value={filters.targetTable || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, targetTable: value === 'all' ? '' : value })}
              >
                <SelectTrigger data-testid="select-target-table">
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {filterOptions?.targetTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
