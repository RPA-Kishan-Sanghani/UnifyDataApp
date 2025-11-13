import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import LineageFilterPanel, { type LineageFilters } from "@/components/lineage-filter-panel";
import LineageDiagram, { type LineageNode, type LineageEdge } from "@/components/lineage-diagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, GitBranch, ArrowUpCircle, ArrowDownCircle, Network } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataLineageDetail {
  lineageId: number;
  lineageType: string;
  applicationName: string | null;
  configKey: string | null;
  sourceLayer: string | null;
  sourceSystem: string | null;
  sourceSchemaName: string | null;
  sourceTableName: string | null;
  sourceAttributeName: string | null;
  targetLayer: string | null;
  targetSystem: string | null;
  targetSchemaName: string | null;
  targetTableName: string | null;
  targetAttributeName: string | null;
  transformationLogic: string | null;
  filterCondition: string | null;
  sourceDatatype: string | null;
  targetDatatype: string | null;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
}

export default function DataLineagePage() {
  const [filters, setFilters] = useState<LineageFilters>({
    globalSearch: '',
    sourceApplicationId: '',
    targetApplicationId: '',
    sourceSchema: '',
    targetSchema: '',
    sourceLayer: '',
    targetLayer: '',
    sourceTable: '',
    targetTable: ''
  });
  
  const [viewMode, setViewMode] = useState<'table' | 'column' | 'combined'>('table');
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [showDiagram, setShowDiagram] = useState(true);

  // Fetch lineage records
  const { data: lineageRecords = [], isLoading, refetch } = useQuery<DataLineageDetail[]>({
    queryKey: ['/api/lineage/records', filters],
    enabled: true,
  });

  // Convert records to nodes and edges based on view mode
  const { nodes, edges } = useMemo(() => {
    if (!lineageRecords || lineageRecords.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodeSet = new Set<string>();
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];

    lineageRecords.forEach((record) => {
      if (viewMode === 'table' || viewMode === 'combined') {
        // Add table-level nodes
        const sourceTableId = `${record.sourceSchemaName}.${record.sourceTableName}`;
        const targetTableId = `${record.targetSchemaName}.${record.targetTableName}`;

        if (!nodeSet.has(sourceTableId) && record.sourceTableName) {
          nodeSet.add(sourceTableId);
          nodes.push({
            id: sourceTableId,
            label: record.sourceTableName,
            type: 'table',
            layer: record.sourceLayer || undefined,
            schema: record.sourceSchemaName || undefined,
            application: record.applicationName || undefined,
            metadata: {
              system: record.sourceSystem,
              configKey: record.configKey,
            }
          });
        }

        if (!nodeSet.has(targetTableId) && record.targetTableName) {
          nodeSet.add(targetTableId);
          nodes.push({
            id: targetTableId,
            label: record.targetTableName,
            type: 'table',
            layer: record.targetLayer || undefined,
            schema: record.targetSchemaName || undefined,
            application: record.applicationName || undefined,
            metadata: {
              system: record.targetSystem,
              configKey: record.configKey,
            }
          });
        }

        // Add table-level edge
        const tableEdgeId = `${sourceTableId}->${targetTableId}`;
        if (!edges.find(e => e.id === tableEdgeId)) {
          edges.push({
            id: tableEdgeId,
            source: sourceTableId,
            target: targetTableId,
            label: record.lineageType,
            transformationLogic: record.transformationLogic || undefined,
            filterCondition: record.filterCondition || undefined,
          });
        }
      }

      if (viewMode === 'column' || viewMode === 'combined') {
        // Add column-level nodes
        const sourceColId = `${record.sourceSchemaName}.${record.sourceTableName}.${record.sourceAttributeName}`;
        const targetColId = `${record.targetSchemaName}.${record.targetTableName}.${record.targetAttributeName}`;

        if (!nodeSet.has(sourceColId) && record.sourceAttributeName) {
          nodeSet.add(sourceColId);
          nodes.push({
            id: sourceColId,
            label: `${record.sourceTableName}.${record.sourceAttributeName}`,
            type: 'column',
            layer: record.sourceLayer || undefined,
            schema: record.sourceSchemaName || undefined,
            application: record.applicationName || undefined,
            metadata: {
              datatype: record.sourceDatatype,
              tableName: record.sourceTableName,
            }
          });
        }

        if (!nodeSet.has(targetColId) && record.targetAttributeName) {
          nodeSet.add(targetColId);
          nodes.push({
            id: targetColId,
            label: `${record.targetTableName}.${record.targetAttributeName}`,
            type: 'column',
            layer: record.targetLayer || undefined,
            schema: record.targetSchemaName || undefined,
            application: record.applicationName || undefined,
            metadata: {
              datatype: record.targetDatatype,
              tableName: record.targetTableName,
            }
          });
        }

        // Add column-level edge
        if (record.sourceAttributeName && record.targetAttributeName) {
          const colEdgeId = `${sourceColId}->${targetColId}`;
          if (!edges.find(e => e.id === colEdgeId)) {
            edges.push({
              id: colEdgeId,
              source: sourceColId,
              target: targetColId,
              label: record.lineageType,
              transformationLogic: record.transformationLogic || undefined,
              filterCondition: record.filterCondition || undefined,
            });
          }
        }
      }
    });

    return { nodes, edges };
  }, [lineageRecords, viewMode]);

  const handleNodeClick = (node: LineageNode) => {
    setSelectedNode(node);
  };

  const handleExportCSV = () => {
    if (lineageRecords.length === 0) return;

    const headers = [
      'Lineage Type', 'Source Layer', 'Source Schema', 'Source Table', 'Source Column',
      'Target Layer', 'Target Schema', 'Target Table', 'Target Column',
      'Transformation Logic', 'Filter Condition', 'Source Datatype', 'Target Datatype'
    ];

    const csvData = lineageRecords.map(record => [
      record.lineageType,
      record.sourceLayer || '',
      record.sourceSchemaName || '',
      record.sourceTableName || '',
      record.sourceAttributeName || '',
      record.targetLayer || '',
      record.targetSchemaName || '',
      record.targetTableName || '',
      record.targetAttributeName || '',
      record.transformationLogic || '',
      record.filterCondition || '',
      record.sourceDatatype || '',
      record.targetDatatype || ''
    ]);

    const csv = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineage-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Filter Panel */}
      <LineageFilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={() => refetch()}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <GitBranch className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Data Lineage
              </h1>
              <Badge variant="secondary" className="text-xs">
                {lineageRecords.length} records
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={lineageRecords.length === 0}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={showDiagram ? 'diagram' : 'table'} onValueChange={(v) => setShowDiagram(v === 'diagram')} className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6">
            <TabsList>
              <TabsTrigger value="diagram" data-testid="tab-diagram">
                <Network className="h-4 w-4 mr-2" />
                Diagram
              </TabsTrigger>
              <TabsTrigger value="table" data-testid="tab-table">
                Table View
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="diagram" className="h-full m-0 p-6">
              <div className="flex space-x-4 h-full">
                {/* Diagram */}
                <div className="flex-1">
                  <div className="mb-4 flex items-center space-x-2">
                    <label className="text-sm font-medium">View:</label>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      data-testid="button-view-table"
                    >
                      Table Level
                    </Button>
                    <Button
                      variant={viewMode === 'column' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('column')}
                      data-testid="button-view-column"
                    >
                      Column Level
                    </Button>
                    <Button
                      variant={viewMode === 'combined' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('combined')}
                      data-testid="button-view-combined"
                    >
                      Combined
                    </Button>
                  </div>
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-96 w-full" />
                    </div>
                  ) : nodes.length === 0 ? (
                    <Card>
                      <CardContent className="flex items-center justify-center h-96">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No lineage data found. Try adjusting your filters.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <LineageDiagram
                      nodes={nodes}
                      edges={edges}
                      onNodeClick={handleNodeClick}
                      viewMode={viewMode}
                    />
                  )}
                </div>

                {/* Node Detail Panel */}
                {selectedNode && (
                  <Card className="w-80 h-fit">
                    <CardHeader>
                      <CardTitle className="text-sm">Node Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Name:</label>
                        <p className="text-sm font-semibold">{selectedNode.label}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Type:</label>
                        <p className="text-sm capitalize">{selectedNode.type}</p>
                      </div>
                      {selectedNode.layer && (
                        <div>
                          <label className="text-xs font-medium text-gray-500">Layer:</label>
                          <p className="text-sm">{selectedNode.layer}</p>
                        </div>
                      )}
                      {selectedNode.schema && (
                        <div>
                          <label className="text-xs font-medium text-gray-500">Schema:</label>
                          <p className="text-sm">{selectedNode.schema}</p>
                        </div>
                      )}
                      {selectedNode.application && (
                        <div>
                          <label className="text-xs font-medium text-gray-500">Application:</label>
                          <p className="text-sm">{selectedNode.application}</p>
                        </div>
                      )}
                      {selectedNode.metadata?.datatype && (
                        <div>
                          <label className="text-xs font-medium text-gray-500">Data Type:</label>
                          <p className="text-sm font-mono text-xs">{selectedNode.metadata.datatype}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="table" className="h-full m-0 p-6">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[calc(100vh-300px)]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Transformation</TableHead>
                          <TableHead>Filter</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            </TableRow>
                          ))
                        ) : lineageRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                              No lineage data found
                            </TableCell>
                          </TableRow>
                        ) : (
                          lineageRecords.map((record, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge variant="outline">{record.lineageType}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500">{record.sourceLayer}</div>
                                  <div className="font-medium text-sm">
                                    {record.sourceSchemaName}.{record.sourceTableName}
                                  </div>
                                  {record.sourceAttributeName && (
                                    <div className="text-xs text-gray-600">{record.sourceAttributeName}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500">{record.targetLayer}</div>
                                  <div className="font-medium text-sm">
                                    {record.targetSchemaName}.{record.targetTableName}
                                  </div>
                                  {record.targetAttributeName && (
                                    <div className="text-xs text-gray-600">{record.targetAttributeName}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div className="text-xs font-mono truncate" title={record.transformationLogic || ''}>
                                  {record.transformationLogic || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div className="text-xs font-mono truncate" title={record.filterCondition || ''}>
                                  {record.filterCondition || '-'}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
