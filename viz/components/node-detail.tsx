"use client";

import { useState, useMemo } from "react";
import type { GraphData, GraphEdge } from "@/lib/types";
import {
  shortSlug,
  CAT_COLORS,
  TOOLKIT_COLORS,
  CLUSTER_COLORS,
  PRIORITY_COLORS,
} from "@/lib/constants";

type Tab = "overview" | "dependencies" | "consumers" | "execution";

export function NodeDetail({
  graph,
  nodeId,
  onClose,
  onNavigate,
}: {
  graph: GraphData;
  nodeId: string;
  onClose: () => void;
  onNavigate?: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const node = graph.nodes.find((n) => n.id === nodeId);

  const deps = useMemo(
    () => graph.edges.filter((e) => e.source === nodeId),
    [graph, nodeId]
  );
  const consumers = useMemo(
    () => graph.edges.filter((e) => e.target === nodeId),
    [graph, nodeId]
  );

  // Group deps by resource
  const depsByResource = useMemo(() => {
    const m = new Map<string, GraphEdge[]>();
    for (const d of deps) {
      const key = d.resource;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [deps]);

  // Group consumers by cluster
  const consumersByCluster = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of consumers) {
      const cNode = graph.nodes.find((n) => n.id === c.source);
      const cluster = cNode?.cluster || "Other";
      if (!m.has(cluster)) m.set(cluster, []);
      const list = m.get(cluster)!;
      if (!list.includes(c.source)) list.push(c.source);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [consumers, graph]);

  const plans = graph.executionPlans[nodeId] || [];
  const uniquePlans = useMemo(() => {
    const seen = new Set<string>();
    return plans.filter((p) => {
      const key = p.chain.join("->");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [plans]);

  if (!node) return null;

  const catColor = CAT_COLORS[node.category] || "#94a3b8";
  const tkColor = TOOLKIT_COLORS[node.toolkit] || "#666";
  const clColor = CLUSTER_COLORS[node.cluster] || "#666";

  const uniqueDeps = [...new Map(deps.map((d) => [d.target, d])).values()];
  const uniqueConsumerIds = [...new Set(consumers.map((c) => c.source))];

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "dependencies", label: "Deps", count: uniqueDeps.length },
    { key: "consumers", label: "Used By", count: uniqueConsumerIds.length },
    { key: "execution", label: "Plan", count: uniquePlans.length },
  ];

  function ToolChip({
    id,
    clickable,
  }: {
    id: string;
    clickable?: boolean;
  }) {
    const n = graph.nodes.find((x) => x.id === id);
    const cat = n?.category || "action";
    const tk = n?.toolkit || "github";
    return (
      <button
        onClick={() => clickable && onNavigate?.(id)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all ${
          clickable
            ? "cursor-pointer hover:bg-[#1a1a2e] active:scale-95"
            : "cursor-default"
        } bg-[#0f0f1a] border border-[#1a1a2e]`}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: CAT_COLORS[cat] }}
        />
        <span className="text-zinc-300 truncate max-w-[200px]">
          {shortSlug(id)}
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
          style={{ background: TOOLKIT_COLORS[tk] }}
        />
      </button>
    );
  }

  return (
    <div className="absolute top-0 left-0 bottom-0 w-[380px] bg-[#0a0a12] border-r border-[#1a1a2e] z-30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-5 border-b border-[#1a1a2e] shrink-0">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-[#1a1a2e] cursor-pointer transition-colors"
        >
          &times;
        </button>

        {/* Category + Toolkit badges */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: catColor + "18",
              color: catColor,
              border: `1px solid ${catColor}30`,
            }}
          >
            {node.category}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: tkColor + "18",
              color: tkColor,
              border: `1px solid ${tkColor}30`,
            }}
          >
            {node.toolkit === "googlesuper" ? "Google" : "GitHub"}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: clColor + "18",
              color: clColor,
              border: `1px solid ${clColor}30`,
            }}
          >
            {node.cluster}
          </span>
        </div>

        {/* Tool name */}
        <h2 className="text-[15px] font-bold text-zinc-100 break-all leading-snug pr-8">
          {shortSlug(node.id)}
        </h2>
        <p className="text-[11px] text-zinc-600 font-mono mt-1 break-all">
          {node.id}
        </p>

        {/* Description */}
        <p className="text-[13px] text-zinc-400 mt-3 leading-relaxed">
          {node.description}
        </p>

        {/* Required params */}
        {node.requiredParams.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5 font-semibold">
              Required Parameters
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.requiredParams.map((p) => {
                const matchingEdge = deps.find((d) => d.param === p);
                const isResolved = !!matchingEdge;
                return (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-mono border"
                    style={{
                      background: isResolved ? "#065f4620" : "#1a1a2e",
                      borderColor: isResolved ? "#34d39930" : "#2a2a4e",
                      color: isResolved ? "#6ee7b7" : "#888",
                    }}
                  >
                    {isResolved && (
                      <span className="text-emerald-500 text-[9px]">&#10003;</span>
                    )}
                    {p}
                    {matchingEdge?.userProvidable && (
                      <span className="text-violet-400 text-[8px] ml-0.5">
                        USR
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="flex gap-4 mt-4 pt-3 border-t border-[#1a1a2e]">
          <div className="text-center">
            <div className="text-[18px] font-bold text-emerald-400">
              {uniqueDeps.length}
            </div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Deps
            </div>
          </div>
          <div className="text-center">
            <div className="text-[18px] font-bold text-amber-400">
              {uniqueConsumerIds.length}
            </div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Used By
            </div>
          </div>
          <div className="text-center">
            <div className="text-[18px] font-bold text-violet-400">
              {uniquePlans.length}
            </div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Chains
            </div>
          </div>
          <div className="text-center">
            <div className="text-[18px] font-bold text-zinc-400">
              {Math.max(0, ...(uniquePlans.map((p) => p.depth) || [0]))}
            </div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              Max Depth
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a2e] shrink-0 px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-all cursor-pointer border-b-2 ${
              tab === t.key
                ? "text-violet-400 border-violet-500"
                : "text-zinc-600 border-transparent hover:text-zinc-400"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  tab === t.key
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-[#1a1a2e] text-zinc-600"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* === OVERVIEW TAB === */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Primary dependencies */}
            {uniqueDeps.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Key Dependencies
                </h3>
                <div className="space-y-1.5">
                  {uniqueDeps
                    .filter((d) => d.priority === 1)
                    .slice(0, 5)
                    .map((d) => (
                      <div
                        key={d.target}
                        className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/20"
                      >
                        <span className="text-emerald-400 text-[10px] font-bold shrink-0">
                          PRIMARY
                        </span>
                        <ToolChip id={d.target} clickable />
                      </div>
                    ))}
                  {uniqueDeps.filter((d) => d.priority === 2).length > 0 && (
                    <div className="text-[10px] text-zinc-600 mt-2">
                      +{uniqueDeps.filter((d) => d.priority === 2).length}{" "}
                      alternative sources
                    </div>
                  )}
                </div>
              </div>
            )}

            {uniqueDeps.length === 0 && (
              <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#1a1a2e] text-center">
                <div className="text-emerald-400 text-lg mb-1">&#9679;</div>
                <div className="text-[12px] text-zinc-400 font-medium">
                  Root Producer
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  No precursor tools needed. This tool can be called directly.
                </div>
              </div>
            )}

            {/* Top consumers */}
            {uniqueConsumerIds.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Top Consumers
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueConsumerIds.slice(0, 8).map((id) => (
                    <ToolChip key={id} id={id} clickable />
                  ))}
                  {uniqueConsumerIds.length > 8 && (
                    <span className="text-[11px] text-zinc-600 self-center px-2">
                      +{uniqueConsumerIds.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Shortest execution chain */}
            {uniquePlans.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Shortest Execution Chain
                </h3>
                <div className="p-3 rounded-lg bg-[#0f0f1a] border border-[#1a1a2e] font-mono text-[11px]">
                  {uniquePlans[0].chain.map((s, i) => (
                    <span key={i}>
                      {i > 0 && (
                        <span className="text-violet-400 mx-1.5">&rarr;</span>
                      )}
                      <span
                        className={
                          i === 0 ? "text-zinc-200 font-semibold" : "text-zinc-500"
                        }
                      >
                        {shortSlug(s)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === DEPENDENCIES TAB === */}
        {tab === "dependencies" && (
          <div className="space-y-4">
            {depsByResource.length === 0 && (
              <div className="text-[12px] text-zinc-600 text-center py-6">
                No dependencies — this is a root producer tool.
              </div>
            )}

            {depsByResource.map(([resource, edges]) => {
              const primary = edges.filter((e) => e.priority === 1);
              const alt = edges.filter((e) => e.priority === 2);
              const indirect = edges.filter((e) => e.priority === 3);

              return (
                <div key={resource}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {resource}
                    </span>
                    <span className="text-[10px] text-zinc-700 font-mono">
                      via {edges[0].param}
                    </span>
                    {edges[0].userProvidable && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400 border border-violet-800/30">
                        USER CAN PROVIDE
                      </span>
                    )}
                  </div>

                  {primary.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[9px] text-emerald-600 uppercase tracking-wider mb-1 font-semibold">
                        Primary Sources
                      </div>
                      {primary.map((d) => (
                        <div
                          key={d.target}
                          className="flex items-start gap-2.5 p-2.5 mb-1.5 rounded-lg bg-emerald-950/15 border border-emerald-900/20"
                        >
                          <span
                            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{ background: "#34d399" }}
                          />
                          <div className="min-w-0 flex-1">
                            <ToolChip id={d.target} clickable />
                            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                              {d.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {alt.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[9px] text-amber-600 uppercase tracking-wider mb-1 font-semibold">
                        Alternatives
                      </div>
                      {alt.map((d) => (
                        <div
                          key={d.target}
                          className="flex items-start gap-2.5 p-2 mb-1 rounded-lg bg-amber-950/10 border border-amber-900/15"
                        >
                          <span
                            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{ background: "#fbbf24" }}
                          />
                          <div className="min-w-0 flex-1">
                            <ToolChip id={d.target} clickable />
                            <p className="text-[11px] text-zinc-600 mt-1">
                              {d.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {indirect.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 font-semibold">
                        Indirect
                      </div>
                      {indirect.map((d) => (
                        <div
                          key={d.target}
                          className="flex items-start gap-2 p-2 mb-1 rounded-lg bg-[#0f0f1a] border border-[#1a1a2e]"
                        >
                          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-zinc-700" />
                          <div className="min-w-0 flex-1">
                            <ToolChip id={d.target} clickable />
                            <p className="text-[11px] text-zinc-600 mt-1">
                              {d.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* === CONSUMERS TAB === */}
        {tab === "consumers" && (
          <div className="space-y-4">
            {consumersByCluster.length === 0 && (
              <div className="text-[12px] text-zinc-600 text-center py-6">
                No tools depend on this one.
              </div>
            )}

            {consumersByCluster.map(([cluster, ids]) => (
              <div key={cluster}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: CLUSTER_COLORS[cluster] || "#666" }}
                  />
                  <span className="text-[12px] font-semibold text-zinc-400">
                    {cluster}
                  </span>
                  <span className="text-[10px] text-zinc-700">
                    ({ids.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-4">
                  {ids.map((id) => (
                    <ToolChip key={id} id={id} clickable />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === EXECUTION PLAN TAB === */}
        {tab === "execution" && (
          <div className="space-y-3">
            {uniquePlans.length === 0 && uniqueDeps.length === 0 && (
              <div className="text-[12px] text-zinc-600 text-center py-6">
                No precursor chain — call this tool directly.
              </div>
            )}

            {uniquePlans.length === 0 && uniqueDeps.length > 0 && (
              <div>
                <div className="text-[11px] text-zinc-500 mb-2">
                  Single-hop dependencies (no multi-step chains):
                </div>
                {[...new Map(deps.map((d) => [d.param, d])).values()].map(
                  (d) => (
                    <div
                      key={d.param}
                      className="p-3 rounded-lg bg-[#0f0f1a] border border-[#1a1a2e] mb-2"
                    >
                      <div className="text-[10px] text-emerald-500 mb-1 font-mono">
                        need: {d.param}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[12px]">
                        <span className="text-zinc-500">
                          {shortSlug(d.target)}
                        </span>
                        <span className="text-violet-400">&rarr;</span>
                        <span className="text-zinc-200 font-semibold">
                          {shortSlug(nodeId)}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {uniquePlans.length > 0 && (
              <div>
                <div className="text-[11px] text-zinc-500 mb-3">
                  Complete execution chains — call tools left to right:
                </div>
                {uniquePlans.slice(0, 12).map((plan, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[#0f0f1a] border border-[#1a1a2e] mb-2"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400 font-mono">
                        depth {plan.depth}
                      </span>
                      <span className="text-[10px] text-zinc-700">
                        {plan.chain.length} tools
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {[...plan.chain].reverse().map((s, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-violet-400 text-xs">
                              &rarr;
                            </span>
                          )}
                          <span
                            className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                              j === plan.chain.length - 1
                                ? "bg-violet-900/30 text-violet-300 font-semibold"
                                : "text-zinc-500"
                            }`}
                          >
                            {shortSlug(s)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
