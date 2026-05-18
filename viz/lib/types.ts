export type GraphNode = {
  id: string;
  toolkit: string;
  category: string;
  cluster: string;
  description: string;
  requiredParams: string[];
};

export type GraphEdge = {
  source: string;
  target: string;
  param: string;
  resource: string;
  priority: 1 | 2 | 3;
  reason: string;
  cluster: string;
  userProvidable: boolean;
};

export type ExecutionPlan = {
  chain: string[];
  depth: number;
};

export type GraphMetadata = {
  totalTools: number;
  connectedTools: number;
  totalEdges: number;
  resources: number;
  clusters: string[];
  multiHopTools: number;
  toolkits: string[];
  generatedAt: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  executionPlans: Record<string, ExecutionPlan[]>;
  metadata: GraphMetadata;
};

export type FilterState = {
  search: string;
  toolkit: string;
  category: string;
  cluster: string | null;
  resource: string | null;
  primaryOnly: boolean;
};
