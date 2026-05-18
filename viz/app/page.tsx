"use client";

import { useEffect, useState } from "react";
import { ForceGraph } from "@/components/force-graph";
import { DagView } from "@/components/dag-view";
import { Sidebar } from "@/components/sidebar";
import { Toolbar } from "@/components/toolbar";
import { PathFinder } from "@/components/path-finder";
import { NodeDetail } from "@/components/node-detail";
import { GuideModal } from "@/components/guide-modal";
import type { GraphData, FilterState } from "@/lib/types";

export type ViewMode = "force" | "dag";

export default function Home() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [view, setView] = useState<ViewMode>("dag");
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    toolkit: "all",
    category: "all",
    cluster: null,
    resource: null,
    primaryOnly: false,
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [pathNode, setPathNode] = useState<string | null>(null);
  const [showPathFinder, setShowPathFinder] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    fetch("/graph.json")
      .then((r) => r.json())
      .then(setGraph);
  }, []);

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-500">Loading dependency graph...</p>
        </div>
      </div>
    );
  }

  const handleSelectNode = (id: string | null) => {
    setSelectedNode(id === selectedNode ? null : id);
    if (showPathFinder && id) setPathNode(id);
  };

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        filters={filters}
        onFiltersChange={setFilters}
        metadata={graph.metadata}
        showPathFinder={showPathFinder}
        onTogglePathFinder={() => setShowPathFinder(!showPathFinder)}
        view={view}
        onViewChange={setView}
        onShowGuide={() => setShowGuide(true)}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {view === "force" ? (
            <ForceGraph
              graph={graph}
              filters={filters}
              selectedNode={selectedNode}
              onSelectNode={handleSelectNode}
            />
          ) : (
            <DagView
              graph={graph}
              filters={filters}
              selectedNode={selectedNode}
              onSelectNode={handleSelectNode}
            />
          )}
          {selectedNode && (
            <NodeDetail
              graph={graph}
              nodeId={selectedNode}
              onClose={() => setSelectedNode(null)}
              onNavigate={(id) => setSelectedNode(id)}
            />
          )}
          {showPathFinder && pathNode && (
            <PathFinder
              graph={graph}
              nodeId={pathNode}
              onClose={() => setPathNode(null)}
            />
          )}
        </div>
        <Sidebar
          graph={graph}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
