"use client";

import { useState, useMemo } from "react";
import type { GraphData, FilterState } from "@/lib/types";
import { CLUSTER_COLORS } from "@/lib/constants";

export function Sidebar({
  graph,
  filters,
  onFiltersChange,
}: {
  graph: GraphData;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}) {
  const [tab, setTab] = useState<"clusters" | "resources">("clusters");

  const clusterCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph.nodes)
      m.set(n.cluster, (m.get(n.cluster) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  const resourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of graph.edges)
      m.set(e.resource, (m.get(e.resource) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  return (
    <div className="w-60 bg-[#08080c]/97 border-l border-[#1a1a2e] flex flex-col backdrop-blur-xl shrink-0">
      <div className="flex border-b border-[#1a1a2e]">
        {(["clusters", "resources"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[10px] uppercase tracking-wider cursor-pointer transition-colors border-b-2 ${
              tab === t
                ? "text-violet-400 border-violet-500"
                : "text-zinc-600 border-transparent hover:text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "clusters" && (
          <>
            <button
              onClick={() => onFiltersChange({ ...filters, cluster: null })}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors mb-0.5 cursor-pointer ${
                !filters.cluster
                  ? "bg-violet-900/30 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e]"
              }`}
            >
              All Clusters
              <span className="float-right text-zinc-600 text-[10px]">
                {graph.nodes.length}
              </span>
            </button>
            {clusterCounts.map(([cl, cnt]) => (
              <button
                key={cl}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    cluster: filters.cluster === cl ? null : cl,
                  })
                }
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors mb-0.5 flex items-center gap-2 cursor-pointer ${
                  filters.cluster === cl
                    ? "bg-violet-900/30 text-violet-300"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: CLUSTER_COLORS[cl] || "#666",
                  }}
                />
                <span className="flex-1 truncate">{cl}</span>
                <span className="text-zinc-600 text-[10px]">{cnt}</span>
              </button>
            ))}
          </>
        )}

        {tab === "resources" && (
          <>
            <button
              onClick={() => onFiltersChange({ ...filters, resource: null })}
              className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors mb-0.5 cursor-pointer ${
                !filters.resource
                  ? "bg-violet-900/30 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e]"
              }`}
            >
              All
              <span className="float-right text-zinc-600 text-[10px]">
                {graph.edges.length}
              </span>
            </button>
            {resourceCounts.map(([res, cnt]) => (
              <button
                key={res}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    resource: filters.resource === res ? null : res,
                  })
                }
                className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors mb-0.5 cursor-pointer ${
                  filters.resource === res
                    ? "bg-violet-900/30 text-violet-300"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e]"
                }`}
              >
                {res}
                <span className="float-right text-zinc-600 text-[10px]">
                  {cnt}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
