"use client";

import type { GraphData } from "@/lib/types";
import { shortSlug } from "@/lib/constants";

export function PathFinder({
  graph,
  nodeId,
  onClose,
}: {
  graph: GraphData;
  nodeId: string;
  onClose: () => void;
}) {
  const plans = graph.executionPlans[nodeId];
  const deps = graph.edges.filter((e) => e.source === nodeId && e.priority <= 2);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-[#0c0c14]/98 border border-[#2a2a4e] rounded-xl p-4 backdrop-blur-xl shadow-2xl z-30">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-300 cursor-pointer text-lg"
      >
        &times;
      </button>

      <div className="text-xs font-semibold text-violet-400 mb-3">
        Execution Plan: {shortSlug(nodeId)}
      </div>

      {(!plans || plans.length === 0) && deps.length === 0 && (
        <div className="text-xs text-zinc-600 bg-[#0f0f1a] rounded-lg px-3 py-2">
          No precursor tools needed — can be called directly.
        </div>
      )}

      {(!plans || plans.length === 0) && deps.length > 0 && (
        <div className="space-y-1.5">
          {[...new Map(deps.map((d) => [d.param, d])).values()].map((d) => (
            <div
              key={d.param}
              className="bg-[#0f0f1a] rounded-lg px-3 py-2 font-mono text-[11px]"
            >
              <span className="text-emerald-400/60 text-[10px]">
                need: {d.param}
              </span>
              <br />
              <span className="text-zinc-400">{shortSlug(d.target)}</span>
              <span className="text-violet-400 mx-2">&rarr;</span>
              <span className="text-zinc-200">{shortSlug(nodeId)}</span>
            </div>
          ))}
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {(() => {
            const seen = new Set<string>();
            return plans
              .filter((p) => {
                const key = p.chain.join("->");
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              })
              .slice(0, 10)
              .map((p, i) => (
                <div
                  key={i}
                  className="bg-[#0f0f1a] rounded-lg px-3 py-2 font-mono text-[11px]"
                >
                  <span className="text-zinc-600 text-[10px]">
                    depth={p.depth}
                  </span>{" "}
                  {p.chain.map((s, j) => (
                    <span key={j}>
                      {j > 0 && (
                        <span className="text-violet-400 mx-1">&rarr;</span>
                      )}
                      <span
                        className={
                          j === 0
                            ? "text-zinc-200"
                            : j === p.chain.length - 1
                              ? "text-zinc-500"
                              : "text-zinc-400"
                        }
                      >
                        {shortSlug(s)}
                      </span>
                    </span>
                  ))}
                </div>
              ));
          })()}
        </div>
      )}
    </div>
  );
}
