import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';

export interface LineageNode {
  id: string;
  label: string;
  type: 'table' | 'column';
  layer?: string;
  schema?: string;
  application?: string;
  metadata?: Record<string, any>;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  transformationLogic?: string;
  filterCondition?: string;
}

interface LineageDiagramProps {
  nodes: LineageNode[];
  edges: LineageEdge[];
  onNodeClick?: (node: LineageNode) => void;
  viewMode: 'table' | 'column' | 'combined';
}

// Layer ordering for layout
const LAYER_ORDER: Record<string, number> = {
  'Raw': 0,
  'raw': 0,
  'NA': 0,
  'na': 0,
  'Source': 0,
  'source': 0,
  'Bronze': 1,
  'bronze': 1,
  'Silver': 2,
  'silver': 2,
  'Gold': 3,
  'gold': 3,
  'Mart': 4,
  'mart': 4,
  'Presentation': 5,
  'presentation': 5,
  'Unknown': 6,
  'unknown': 6,
};

// Layer colors
const LAYER_COLORS: Record<string, string> = {
  'Raw': '#94a3b8',
  'raw': '#94a3b8',
  'NA': '#94a3b8',
  'na': '#94a3b8',
  'Source': '#94a3b8',
  'source': '#94a3b8',
  'Bronze': '#cd7f32',
  'bronze': '#cd7f32',
  'Silver': '#c0c0c0',
  'silver': '#c0c0c0',
  'Gold': '#ffd700',
  'gold': '#ffd700',
  'Mart': '#10b981',
  'mart': '#10b981',
  'Presentation': '#06b6d4',
  'presentation': '#06b6d4',
  'Unknown': '#6b7280',
  'unknown': '#6b7280',
};

const CustomTableNode = ({ data }: { data: any }) => (
  <div
    className="px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-shadow cursor-pointer min-w-[180px]"
    style={{ borderColor: data.color || '#3b82f6' }}
  >
    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
      {data.label}
    </div>
    {data.schema && (
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Schema: {data.schema}
      </div>
    )}
    {data.layer && (
      <div className="text-xs font-medium" style={{ color: data.color || '#3b82f6' }}>
        {data.layer}
      </div>
    )}
  </div>
);

const CustomColumnNode = ({ data }: { data: any }) => (
  <div
    className="px-3 py-2 rounded border bg-white dark:bg-gray-900 shadow hover:shadow-md transition-shadow cursor-pointer min-w-[140px]"
    style={{ borderColor: data.color || '#6366f1' }}
  >
    <div className="font-medium text-xs text-gray-900 dark:text-gray-100">
      {data.label}
    </div>
    {data.datatype && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {data.datatype}
      </div>
    )}
  </div>
);

const nodeTypes = {
  tableNode: CustomTableNode,
  columnNode: CustomColumnNode,
};

export default function LineageDiagram({
  nodes: lineageNodes,
  edges: lineageEdges,
  onNodeClick,
  viewMode,
}: LineageDiagramProps) {
  // Convert lineage nodes to ReactFlow nodes with auto-layout
  const flowNodes: Node[] = useMemo(() => {
    // Group nodes by layer
    const nodesByLayer: Record<number, LineageNode[]> = {};
    
    lineageNodes.forEach((node) => {
      const layer = node.layer || 'Unknown';
      const layerIndex = LAYER_ORDER[layer] ?? 999;
      
      if (!nodesByLayer[layerIndex]) {
        nodesByLayer[layerIndex] = [];
      }
      nodesByLayer[layerIndex].push(node);
    });

    // Calculate positions
    const result: Node[] = [];
    const LAYER_SPACING = 350;
    const NODE_SPACING = 100;
    
    Object.keys(nodesByLayer)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((layerIndexStr) => {
        const layerIndex = parseInt(layerIndexStr);
        const nodesInLayer = nodesByLayer[layerIndex];
        const x = layerIndex * LAYER_SPACING;
        
        nodesInLayer.forEach((node, index) => {
          const y = index * NODE_SPACING;
          const color = LAYER_COLORS[node.layer || ''] || '#3b82f6';
          
          result.push({
            id: node.id,
            type: node.type === 'column' ? 'columnNode' : 'tableNode',
            position: { x, y },
            data: {
              label: node.label,
              layer: node.layer,
              schema: node.schema,
              application: node.application,
              color,
              datatype: node.metadata?.datatype,
              ...node.metadata,
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
        });
      });
    
    return result;
  }, [lineageNodes]);

  // Convert lineage edges to ReactFlow edges
  const flowEdges: Edge[] = useMemo(() => {
    return lineageEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      style: {
        stroke: '#6b7280',
        strokeWidth: 2,
      },
      labelStyle: {
        fontSize: 10,
        fill: '#4b5563',
      },
      labelBgStyle: {
        fill: '#f3f4f6',
        fillOpacity: 0.9,
      },
    }));
  }, [lineageEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update nodes and edges when data changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: any, node: Node) => {
      if (onNodeClick) {
        const lineageNode = lineageNodes.find((n) => n.id === node.id);
        if (lineageNode) {
          onNodeClick(lineageNode);
        }
      }
    },
    [lineageNodes, onNodeClick]
  );

  return (
    <Card className="w-full h-full">
      <div className="w-full h-full" style={{ minHeight: '600px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-right"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-white dark:bg-gray-800"
          />
        </ReactFlow>
      </div>
    </Card>
  );
}
