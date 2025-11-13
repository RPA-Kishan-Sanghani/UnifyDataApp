// Lineage Graph Utility - In-memory graph indexing and recursive traversal

export interface LineageRecord {
  lineageId: string;
  lineageType: string;
  applicationName: string | null;
  configKey: string | null;
  dataElementId: string | null;
  sourceLayer: string | null;
  sourceSystem: string | null;
  sourceSchemaName: string | null;
  sourceTableName: string | null;
  sourceColumn: string | null;
  targetLayer: string | null;
  targetSystem: string | null;
  targetSchemaName: string | null;
  targetTableName: string | null;
  targetColumn: string | null;
  transformationLogic: string | null;
  filterCondition: string | null;
  updateAt: Date | null;
  createdBy: string | null;
  createdTs: Date | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  activeFlag: string | null;
  sourceDatatype: string | null;
  targetDatatype: string | null;
}

export interface LineageNode {
  id: string;
  type: 'table' | 'column';
  layer: string | null;
  schema: string | null;
  table: string;
  column?: string;
  system: string | null;
  datatype?: string | null;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  lineageType: string;
  transformationLogic: string | null;
  filterCondition: string | null;
  sourceDatatype: string | null;
  targetDatatype: string | null;
}

export interface LineageGraph {
  nodes: Map<string, LineageNode>;
  edges: LineageEdge[];
  sourceIndex: Map<string, LineageRecord[]>;  // target -> records
  targetIndex: Map<string, LineageRecord[]>;  // source -> records
  tableIndex: Map<string, LineageRecord[]>;   // table -> records
}

export class LineageGraphBuilder {
  /**
   * Build in-memory graph with fast lookup indexes
   */
  static buildGraph(records: LineageRecord[]): LineageGraph {
    const nodes = new Map<string, LineageNode>();
    const edges: LineageEdge[] = [];
    const sourceIndex = new Map<string, LineageRecord[]>();
    const targetIndex = new Map<string, LineageRecord[]>();
    const tableIndex = new Map<string, LineageRecord[]>();

    for (const record of records) {
      // Build nodes
      const sourceNodeId = this.getNodeId(
        record.sourceSchemaName,
        record.sourceTableName,
        record.sourceColumn
      );
      const targetNodeId = this.getNodeId(
        record.targetSchemaName,
        record.targetTableName,
        record.targetColumn
      );

      // Add source node
      if (sourceNodeId && !nodes.has(sourceNodeId)) {
        nodes.set(sourceNodeId, {
          id: sourceNodeId,
          type: record.sourceColumn ? 'column' : 'table',
          layer: record.sourceLayer,
          schema: record.sourceSchemaName,
          table: record.sourceTableName || '',
          column: record.sourceColumn || undefined,
          system: record.sourceSystem,
          datatype: record.sourceDatatype,
        });
      }

      // Add target node
      if (targetNodeId && !nodes.has(targetNodeId)) {
        nodes.set(targetNodeId, {
          id: targetNodeId,
          type: record.targetColumn ? 'column' : 'table',
          layer: record.targetLayer,
          schema: record.targetSchemaName,
          table: record.targetTableName || '',
          column: record.targetColumn || undefined,
          system: record.targetSystem,
          datatype: record.targetDatatype,
        });
      }

      // Add edge
      if (sourceNodeId && targetNodeId) {
        edges.push({
          id: record.lineageId,
          source: sourceNodeId,
          target: targetNodeId,
          lineageType: record.lineageType,
          transformationLogic: record.transformationLogic,
          filterCondition: record.filterCondition,
          sourceDatatype: record.sourceDatatype,
          targetDatatype: record.targetDatatype,
        });
      }

      // Build indexes for fast lookup
      // sourceIndex: key = target identifier, value = records pointing TO this target
      if (targetNodeId) {
        if (!sourceIndex.has(targetNodeId)) {
          sourceIndex.set(targetNodeId, []);
        }
        sourceIndex.get(targetNodeId)!.push(record);
      }

      // targetIndex: key = source identifier, value = records coming FROM this source
      if (sourceNodeId) {
        if (!targetIndex.has(sourceNodeId)) {
          targetIndex.set(sourceNodeId, []);
        }
        targetIndex.get(sourceNodeId)!.push(record);
      }

      // tableIndex: index by table name for both source and target
      const sourceTableKey = this.getTableKey(record.sourceSchemaName, record.sourceTableName);
      if (sourceTableKey) {
        if (!tableIndex.has(sourceTableKey)) {
          tableIndex.set(sourceTableKey, []);
        }
        tableIndex.get(sourceTableKey)!.push(record);
      }

      const targetTableKey = this.getTableKey(record.targetSchemaName, record.targetTableName);
      if (targetTableKey) {
        if (!tableIndex.has(targetTableKey)) {
          tableIndex.set(targetTableKey, []);
        }
        tableIndex.get(targetTableKey)!.push(record);
      }
    }

    return { nodes, edges, sourceIndex, targetIndex, tableIndex };
  }

  /**
   * Generate unique node ID
   */
  private static getNodeId(schema: string | null, table: string | null, column: string | null): string | null {
    if (!table) return null;
    const schemaPrefix = schema ? `${schema}.` : '';
    const columnSuffix = column ? `.${column}` : '';
    return `${schemaPrefix}${table}${columnSuffix}`;
  }

  /**
   * Generate table key for indexing
   */
  private static getTableKey(schema: string | null, table: string | null): string | null {
    if (!table) return null;
    return schema ? `${schema}.${table}` : table;
  }

  /**
   * Trace upstream lineage recursively (backward lineage)
   * Find all sources that feed into the given target
   */
  static traceUpstream(
    graph: LineageGraph,
    targetNodeId: string,
    visited: Set<string> = new Set()
  ): {
    nodes: LineageNode[];
    edges: LineageEdge[];
    paths: string[][];
  } {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    const paths: string[][] = [];

    if (visited.has(targetNodeId)) {
      return { nodes, edges, paths };
    }

    visited.add(targetNodeId);

    // Get the target node
    const targetNode = graph.nodes.get(targetNodeId);
    if (targetNode) {
      nodes.push(targetNode);
    }

    // Find all records that have this node as target (upstream sources)
    const upstreamRecords = graph.sourceIndex.get(targetNodeId) || [];

    for (const record of upstreamRecords) {
      const sourceNodeId = this.getNodeId(
        record.sourceSchemaName,
        record.sourceTableName,
        record.sourceColumn
      );

      if (!sourceNodeId) continue;

      // Add edge
      const edge = graph.edges.find(e => e.id === record.lineageId);
      if (edge) {
        edges.push(edge);
      }

      // Recursively trace upstream
      const upstreamResult = this.traceUpstream(graph, sourceNodeId, visited);
      nodes.push(...upstreamResult.nodes);
      edges.push(...upstreamResult.edges);

      // Build path
      if (upstreamResult.paths.length === 0) {
        paths.push([sourceNodeId, targetNodeId]);
      } else {
        for (const path of upstreamResult.paths) {
          paths.push([...path, targetNodeId]);
        }
      }
    }

    return { nodes, edges, paths };
  }

  /**
   * Trace downstream lineage recursively (forward lineage)
   * Find all targets that are derived from the given source
   */
  static traceDownstream(
    graph: LineageGraph,
    sourceNodeId: string,
    visited: Set<string> = new Set()
  ): {
    nodes: LineageNode[];
    edges: LineageEdge[];
    paths: string[][];
  } {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    const paths: string[][] = [];

    if (visited.has(sourceNodeId)) {
      return { nodes, edges, paths };
    }

    visited.add(sourceNodeId);

    // Get the source node
    const sourceNode = graph.nodes.get(sourceNodeId);
    if (sourceNode) {
      nodes.push(sourceNode);
    }

    // Find all records that have this node as source (downstream targets)
    const downstreamRecords = graph.targetIndex.get(sourceNodeId) || [];

    for (const record of downstreamRecords) {
      const targetNodeId = this.getNodeId(
        record.targetSchemaName,
        record.targetTableName,
        record.targetColumn
      );

      if (!targetNodeId) continue;

      // Add edge
      const edge = graph.edges.find(e => e.id === record.lineageId);
      if (edge) {
        edges.push(edge);
      }

      // Recursively trace downstream
      const downstreamResult = this.traceDownstream(graph, targetNodeId, visited);
      nodes.push(...downstreamResult.nodes);
      edges.push(...downstreamResult.edges);

      // Build path
      if (downstreamResult.paths.length === 0) {
        paths.push([sourceNodeId, targetNodeId]);
      } else {
        for (const path of downstreamResult.paths) {
          paths.push([sourceNodeId, ...path]);
        }
      }
    }

    return { nodes, edges, paths };
  }

  /**
   * Trace both upstream and downstream from a given node
   */
  static traceFullLineage(
    graph: LineageGraph,
    nodeId: string
  ): {
    nodes: LineageNode[];
    edges: LineageEdge[];
    upstreamPaths: string[][];
    downstreamPaths: string[][];
  } {
    const upstream = this.traceUpstream(graph, nodeId);
    const downstream = this.traceDownstream(graph, nodeId);

    // Deduplicate nodes and edges
    const nodesMap = new Map<string, LineageNode>();
    const edgesMap = new Map<string, LineageEdge>();

    for (const node of [...upstream.nodes, ...downstream.nodes]) {
      nodesMap.set(node.id, node);
    }

    for (const edge of [...upstream.edges, ...downstream.edges]) {
      edgesMap.set(edge.id, edge);
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      upstreamPaths: upstream.paths,
      downstreamPaths: downstream.paths,
    };
  }

  /**
   * Get lineage by table (all columns in the table)
   */
  static getTableLineage(
    graph: LineageGraph,
    schema: string | null,
    table: string
  ): {
    nodes: LineageNode[];
    edges: LineageEdge[];
  } {
    const tableKey = this.getTableKey(schema, table);
    if (!tableKey) {
      return { nodes: [], edges: [] };
    }

    const records = graph.tableIndex.get(tableKey) || [];
    const nodesMap = new Map<string, LineageNode>();
    const edgesMap = new Map<string, LineageEdge>();

    for (const record of records) {
      const sourceNodeId = this.getNodeId(
        record.sourceSchemaName,
        record.sourceTableName,
        record.sourceColumn
      );
      const targetNodeId = this.getNodeId(
        record.targetSchemaName,
        record.targetTableName,
        record.targetColumn
      );

      if (sourceNodeId) {
        const node = graph.nodes.get(sourceNodeId);
        if (node) nodesMap.set(node.id, node);
      }

      if (targetNodeId) {
        const node = graph.nodes.get(targetNodeId);
        if (node) nodesMap.set(node.id, node);
      }

      const edge = graph.edges.find(e => e.id === record.lineageId);
      if (edge) {
        edgesMap.set(edge.id, edge);
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  }
}
