"use client";

import { useState } from "react";

const STEPS = [
  {
    title: "Welcome to Composio Dep Graph",
    subtitle: "Interactive dependency graph for 667 tools across Google Super + GitHub",
    content: [
      "This app visualizes **which tools need other tools** to run. When an AI agent calls a tool like `REPLY_TO_THREAD`, it first needs a `thread_id` — which comes from `LIST_THREADS`.",
      "The graph maps all these precursor relationships across **48 resource types** and **23 service clusters**.",
    ],
    icon: "🔗",
  },
  {
    title: "Two Views",
    subtitle: "Switch between Force and Layered layouts",
    content: [
      "**Layered (default)** — Horizontal DAG with vertical columns. Producers on the left, consumers on the right. Grouped by service cluster (Gmail, Drive, Issues, PRs, etc.).",
      "**Force** — Living, breathing force-directed graph. Nodes drift and cluster organically. Drag nodes to reorganize.",
      'Toggle views with the **Force / Layered** switcher in the toolbar.',
    ],
    icon: "👁",
  },
  {
    title: "Navigate Clusters",
    subtitle: "Jump to any service area instantly",
    content: [
      "In **Layered view**, the left panel lists all clusters (Google and GitHub sections).",
      "**Click a cluster** to zoom in and lock the highlight — only that cluster's nodes and edges stay visible.",
      "**Click again** to unlock, or hit **Clear Selection** to reset.",
      "**Hover** a cluster (when unlocked) for a quick preview.",
    ],
    icon: "🧭",
  },
  {
    title: "Inspect Tools",
    subtitle: "Click any node for full details",
    content: [
      "**Click a node** on the canvas to open the detail panel with 4 tabs:",
      "**Overview** — Quick summary: key deps, top consumers, shortest chain.",
      "**Deps** — All dependencies grouped by resource, with Primary/Alternative/Indirect badges and explanations.",
      "**Used By** — Tools that depend on this one, grouped by cluster.",
      "**Plan** — Full multi-hop execution chains showing the complete call sequence.",
      "Click any tool chip in the panel to navigate to it.",
    ],
    icon: "🔍",
  },
  {
    title: "Filter & Search",
    subtitle: "Narrow down to exactly what you need",
    content: [
      "**Search** — Type any tool name or keyword to filter.",
      "**Toolkit** — Show only Google Super or GitHub tools.",
      "**Category** — Filter by Retrievers, Creators, Updaters, Deleters, etc.",
      "**Primary Only** — Hide alternative/indirect edges, show only recommended paths.",
      "**Right sidebar** — Filter by cluster or resource type (e.g., `gmail_thread`, `gh_pull_request`).",
    ],
    icon: "🎯",
  },
  {
    title: "Path Finder",
    subtitle: "See the full execution plan for any tool",
    content: [
      'Toggle **Path Finder** in the toolbar, then click any node.',
      "Shows the complete multi-hop chain: which tools to call and in what order.",
      "Example: `DELETE_RELEASE_ASSET` → needs `LIST_RELEASE_ASSETS` → needs `LIST_RELEASES`.",
    ],
    icon: "🛤",
  },
  {
    title: "Edge Colors & Node Styles",
    subtitle: "Visual language at a glance",
    content: [
      "**Green edges** — Primary (recommended) dependency path.",
      "**Yellow edges** — Alternative source for the same parameter.",
      "**Dashed gray edges** — Indirect/circular references.",
      "**Node colors** — Cyan=Retriever, Purple=Getter, Green=Creator, Yellow=Updater, Red=Deleter.",
      "**Dashed node border** — Parameter is user-providable (don't always need a precursor call).",
      "**Node size** — Larger = more connections.",
    ],
    icon: "🎨",
  },
  {
    title: "Canvas Controls",
    subtitle: "Zoom, pan, and interact",
    content: [
      "**Scroll** to zoom in/out.",
      "**Drag background** to pan.",
      "**Drag nodes** (Force view) to reposition.",
      "**Click node** to select and highlight dependencies.",
      "**Click background** to deselect.",
      "**Minimap** (Layered view, bottom-left) — click to jump to a cluster.",
    ],
    icon: "🖱",
  },
];

export function GuideModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[520px] max-w-[90vw] max-h-[85vh] bg-[#0c0c14] border border-[#2a2a4e] rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-[#1a1a2e]">
          <div
            className="h-full bg-violet-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-3xl mb-4">{current.icon}</div>

          <h2 className="text-xl font-bold text-zinc-100 mb-1">
            {current.title}
          </h2>
          <p className="text-sm text-violet-400 mb-5">{current.subtitle}</p>

          <div className="space-y-3">
            {current.content.map((line, i) => (
              <p
                key={i}
                className="text-[13px] text-zinc-400 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: line
                    .replace(
                      /\*\*(.+?)\*\*/g,
                      '<span class="text-zinc-200 font-semibold">$1</span>'
                    )
                    .replace(
                      /`(.+?)`/g,
                      '<code class="text-emerald-400 bg-emerald-950/30 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
                    ),
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-[#1a1a2e]">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  i === step
                    ? "bg-violet-500 w-5"
                    : i < step
                      ? "bg-violet-800"
                      : "bg-[#2a2a4e]"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg cursor-pointer transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg cursor-pointer transition-colors"
              >
                Start Exploring
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 cursor-pointer text-sm px-2 py-1 rounded hover:bg-[#1a1a2e] transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
