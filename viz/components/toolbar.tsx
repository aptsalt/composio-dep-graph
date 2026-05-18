"use client";

import type { FilterState, GraphMetadata } from "@/lib/types";
import type { ViewMode } from "@/app/page";

export function Toolbar({
  filters,
  onFiltersChange,
  metadata,
  showPathFinder,
  onTogglePathFinder,
  view,
  onViewChange,
  onShowGuide,
}: {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  metadata: GraphMetadata;
  showPathFinder: boolean;
  onTogglePathFinder: () => void;
  view: ViewMode;
  onShowGuide: () => void;
  onViewChange: (v: ViewMode) => void;
}) {
  const inputCls =
    "bg-[#12121e] border border-[#2a2a4e] text-zinc-200 px-3 py-1.5 rounded-md text-xs outline-none focus:border-violet-500 transition-colors";
  const btnCls = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs border transition-all cursor-pointer ${
      active
        ? "bg-violet-900/50 text-violet-300 border-violet-500"
        : "bg-[#12121e] text-zinc-500 border-[#2a2a4e] hover:text-zinc-300"
    }`;

  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 bg-[#08080c]/97 border-b border-[#1a1a2e] backdrop-blur-xl z-50 flex-wrap">
      <h1 className="text-sm font-semibold text-violet-400 mr-1 whitespace-nowrap">
        Composio Dep Graph
      </h1>

      {/* View switcher */}
      <div className="flex bg-[#0f0f1a] rounded-lg border border-[#2a2a4e] overflow-hidden">
        <button
          onClick={() => onViewChange("force")}
          className={`px-3 py-1.5 text-[11px] transition-all cursor-pointer ${
            view === "force"
              ? "bg-violet-600/30 text-violet-300"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Force
        </button>
        <button
          onClick={() => onViewChange("dag")}
          className={`px-3 py-1.5 text-[11px] transition-all cursor-pointer border-l border-[#2a2a4e] ${
            view === "dag"
              ? "bg-violet-600/30 text-violet-300"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Layered
        </button>
      </div>

      <div className="w-px h-5 bg-[#2a2a4e]" />

      <input
        type="text"
        placeholder="Search tools..."
        value={filters.search}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        className={`${inputCls} w-48`}
      />

      <select
        value={filters.toolkit}
        onChange={(e) =>
          onFiltersChange({ ...filters, toolkit: e.target.value })
        }
        className={`${inputCls} cursor-pointer`}
      >
        <option value="all">All Toolkits</option>
        <option value="googlesuper">Google Super</option>
        <option value="github">GitHub</option>
      </select>

      <select
        value={filters.category}
        onChange={(e) =>
          onFiltersChange({ ...filters, category: e.target.value })
        }
        className={`${inputCls} cursor-pointer`}
      >
        <option value="all">All Types</option>
        <option value="retriever">Retrievers</option>
        <option value="getter">Getters</option>
        <option value="creator">Creators</option>
        <option value="updater">Updaters</option>
        <option value="deleter">Deleters</option>
        <option value="action">Actions</option>
      </select>

      <button
        onClick={() =>
          onFiltersChange({ ...filters, primaryOnly: !filters.primaryOnly })
        }
        className={btnCls(filters.primaryOnly)}
      >
        Primary Only
      </button>

      <button onClick={onTogglePathFinder} className={btnCls(showPathFinder)}>
        Path Finder
      </button>

      <span className="ml-auto text-[11px] text-zinc-600 whitespace-nowrap">
        {metadata.connectedTools} tools &middot; {metadata.totalEdges} deps
        &middot; {metadata.resources} resources
      </span>

      <button
        onClick={onShowGuide}
        className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-violet-400 hover:bg-[#1a1a2e] cursor-pointer transition-colors text-sm"
        title="How to use this app"
      >
        ?
      </button>
    </div>
  );
}
