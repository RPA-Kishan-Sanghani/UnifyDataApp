import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Trash2, Edit2, Check, X, GripVertical, Sparkles } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useChatEdit } from '@/contexts/ChatEditContext';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1'];

interface SavedChart {
  chartId: string;
  userId: string;
  title: string;
  sql: string;
  chartType: string;
  chartData: string;
  columns: string | null;
  connectionName: string;
  layer: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  createdAt: Date;
  lastRefreshedAt: Date;
}

export default function CustomDashboard() {
  const { toast } = useToast();
  const { setEditChart } = useChatEdit();
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState<string>('');

  // Fetch all saved charts
  const { data: charts = [], isLoading } = useQuery<SavedChart[]>({
    queryKey: ['/api/saved-charts'],
  });

  // Delete chart mutation
  const deleteChartMutation = useMutation({
    mutationFn: async (chartId: string) => {
      await apiRequest('DELETE', `/api/saved-charts/${chartId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-charts'] });
      toast({
        title: "Chart Deleted",
        description: "The chart has been removed from your dashboard.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete chart.",
        variant: "destructive",
      });
    },
  });

  // Update chart mutation (for title and position)
  const updateChartMutation = useMutation({
    mutationFn: async ({ chartId, updates }: { chartId: string; updates: any }) => {
      await apiRequest('PATCH', `/api/saved-charts/${chartId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-charts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update chart.",
        variant: "destructive",
      });
    },
  });

  // Refresh chart mutation
  const refreshChartMutation = useMutation({
    mutationFn: async (chartId: string) => {
      const response = await apiRequest('POST', `/api/saved-charts/${chartId}/refresh`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-charts'] });
      toast({
        title: "Chart Refreshed",
        description: "Chart data has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh chart data.",
        variant: "destructive",
      });
    },
  });

  // Handle layout change (drag/drop/resize)
  const handleLayoutChange = useCallback((layout: Layout[]) => {
    layout.forEach((item) => {
      const chart = charts.find(c => c.chartId === item.i);
      if (chart && (
        chart.gridX !== item.x ||
        chart.gridY !== item.y ||
        chart.gridW !== item.w ||
        chart.gridH !== item.h
      )) {
        updateChartMutation.mutate({
          chartId: item.i,
          updates: {
            gridX: item.x,
            gridY: item.y,
            gridW: item.w,
            gridH: item.h,
          },
        });
      }
    });
  }, [charts]);

  // Start editing title
  const startEditTitle = (chartId: string, currentTitle: string) => {
    setEditingChartId(chartId);
    setEditedTitle(currentTitle);
  };

  // Save edited title
  const saveTitle = (chartId: string) => {
    if (editedTitle.trim()) {
      updateChartMutation.mutate({
        chartId,
        updates: { title: editedTitle },
      });
    }
    setEditingChartId(null);
    setEditedTitle('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingChartId(null);
    setEditedTitle('');
  };

  // Render chart based on type with dynamic sizing
  const renderChart = (chartType: string, data: any[], columns: string[], gridH: number) => {
    if (!data || data.length === 0) {
      return <p className="text-sm text-gray-500">No data available</p>;
    }

    // Dynamic chart dimensions based on grid tile size
    const ROW_HEIGHT = 100; // matches rowHeight in ResponsiveGridLayout
    const HEADER_HEIGHT = 50; // approximate header height
    const PADDING = 32; // p-4 padding (16px top + 16px bottom)
    const chartHeight = (gridH * ROW_HEIGHT) - HEADER_HEIGHT - PADDING;
    
    // Dynamic font sizes based on chart height
    const baseFontSize = Math.max(10, Math.min(12, chartHeight / 30));
    const fontSize = { fontSize: baseFontSize };
    const labelStyle = { fontSize: baseFontSize - 1 };
    const legendStyle = { fontSize: baseFontSize - 1 };

    // Custom label renderer for pie chart to prevent overflow
    const renderPieLabel = ({ name, percent }: any) => {
      const maxLength = chartHeight < 200 ? 8 : chartHeight < 300 ? 12 : 15;
      const truncatedName = name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
      return `${truncatedName}: ${(percent * 100).toFixed(0)}%`;
    };

    switch (chartType) {
      case 'pie':
        const pieData = data.map(row => ({
          name: row[columns[0]],
          value: parseFloat(row[columns[1]]) || 0
        }));
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                outerRadius="60%"
                fill="#8884d8"
                dataKey="value"
                style={labelStyle}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={fontSize} />
              <Legend wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
      case 'histogram':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={columns[0]} tick={fontSize} height={60} angle={-15} textAnchor="end" />
              <YAxis tick={fontSize} width={50} />
              <Tooltip contentStyle={fontSize} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey={columns[1]} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={columns[0]} tick={fontSize} height={60} angle={-15} textAnchor="end" />
              <YAxis tick={fontSize} width={50} />
              <Tooltip contentStyle={fontSize} />
              <Legend wrapperStyle={legendStyle} />
              <Line type="monotone" dataKey={columns[1]} stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        return (
          <div className="overflow-auto h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col, idx) => (
                    <TableHead key={idx} className="text-xs">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 10).map((row, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {columns.map((col, colIdx) => (
                      <TableCell key={colIdx} className="text-xs">{row[col]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
    }
  };

  // Convert charts to grid layout format
  const layouts = {
    lg: charts.map(chart => ({
      i: chart.chartId,
      x: chart.gridX,
      y: chart.gridY,
      w: chart.gridW,
      h: chart.gridH,
      minW: 3,
      minH: 3,
    })),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Custom Dashboard</h1>
          <p className="text-gray-600 mb-6">Pin charts and tables from your chat conversations to build your personalized dashboard</p>
          <Card className="p-12 text-center">
            <p className="text-gray-500 mb-4">No charts pinned yet</p>
            <p className="text-sm text-gray-400">Open the chat, run a query, and click "Pin to Dashboard" to add charts here</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Custom Dashboard</h1>
            <p className="text-gray-600">Drag the grip icon (⋮⋮) to rearrange your charts • 3 charts per row</p>
          </div>
          <Button
            onClick={() => {
              charts.forEach(chart => refreshChartMutation.mutate(chart.chartId));
            }}
            disabled={refreshChartMutation.isPending}
            data-testid="button-refresh-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshChartMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>

        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={100}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
        >
          {charts.map(chart => {
            const data = JSON.parse(chart.chartData);
            const columns = chart.columns ? JSON.parse(chart.columns) : [];

            return (
              <div key={chart.chartId} data-testid={`chart-${chart.chartId}`}>
                <Card className="h-full flex flex-col overflow-hidden">
                  <CardHeader className="border-b p-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="drag-handle cursor-move p-0.5 hover:bg-gray-100 rounded flex-shrink-0" title="Drag to reposition">
                        <GripVertical className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0">
                        {editingChartId === chart.chartId ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Input
                              value={editedTitle}
                              onChange={(e) => setEditedTitle(e.target.value)}
                              className="text-xs h-7 flex-1 min-w-0"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTitle(chart.chartId);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              data-testid="input-edit-title"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation();
                                saveTitle(chart.chartId);
                              }}
                              className="h-7 w-7 p-0 flex-shrink-0"
                              data-testid="button-save-title"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEdit();
                              }}
                              className="h-7 w-7 p-0 flex-shrink-0"
                              data-testid="button-cancel-edit"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <CardTitle className="text-xs font-semibold flex-1 min-w-0 truncate" title={chart.title}>
                              {chart.title}
                            </CardTitle>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const chartData = JSON.parse(chart.chartData);
                                  const chartColumns = chart.columns ? JSON.parse(chart.columns) : [];
                                  setEditChart({
                                    chartId: chart.chartId,
                                    title: chart.title,
                                    sql: chart.sql,
                                    chartType: chart.chartType,
                                    connectionName: chart.connectionName,
                                    layer: chart.layer,
                                    data: chartData,
                                    columns: chartColumns,
                                  });
                                }}
                                title="Edit with AI"
                                className="h-7 w-7 p-0"
                                data-testid="button-edit-with-ai"
                              >
                                <Sparkles className="h-3 w-3 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditTitle(chart.chartId, chart.title);
                                }}
                                title="Edit Title"
                                className="h-7 w-7 p-0"
                                data-testid="button-edit-title"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshChartMutation.mutate(chart.chartId);
                                }}
                                disabled={refreshChartMutation.isPending}
                                title="Refresh"
                                className="h-7 w-7 p-0"
                                data-testid="button-refresh-chart"
                              >
                                <RefreshCw className={`h-3 w-3 ${refreshChartMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteChartMutation.mutate(chart.chartId);
                                }}
                                title="Delete"
                                className="h-7 w-7 p-0"
                                data-testid="button-delete-chart"
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 overflow-hidden">
                    <div className="w-full overflow-hidden">
                      {renderChart(chart.chartType, data, columns, chart.gridH)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
