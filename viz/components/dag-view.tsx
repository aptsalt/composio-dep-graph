"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import * as d3 from "d3";
import type { GraphData, FilterState } from "@/lib/types";
import {
  CAT_COLORS,
  TOOLKIT_COLORS,
  PRIORITY_COLORS,
  CLUSTER_COLORS,
  shortSlug,
} from "@/lib/constants";

type LayoutNode = {
  id: string;
  toolkit: string;
  category: string;
  cluster: string;
  description: string;
  requiredParams: string[];
  x: number;
  y: number;
  col: number;
  row: number;
  r: number;
};

type LayoutLink = {
  source: LayoutNode;
  target: LayoutNode;
  param: string;
  resource: string;
  priority: number;
  reason: string;
  userProvidable: boolean;
};

type ClusterBounds = {
  cluster: string;
  toolkit: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
  count: number;
};

export function DagView({
  graph,
  filters,
  selectedNode,
  onSelectNode,
}: {
  graph: GraphData;
  filters: FilterState;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const hoverRef = useRef<string | null>(null);
  const layoutRef = useRef<{
    nodes: LayoutNode[];
    links: LayoutLink[];
    columns: Map<number, LayoutNode[]>;
    clusterBounds: ClusterBounds[];
  } | null>(null);

  const [clusterBounds, setClusterBounds] = useState<ClusterBounds[]>([]);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [lockedCluster, setLockedCluster] = useState<string | null>(null);
  const activeCluster = lockedCluster || hoveredCluster;

  // Adjacency
  const adjacency = useMemo(() => {
    const out = new Map<string, typeof graph.edges>();
    const inc = new Map<string, typeof graph.edges>();
    for (const e of graph.edges) {
      if (!out.has(e.source)) out.set(e.source, []);
      out.get(e.source)!.push(e);
      if (!inc.has(e.target)) inc.set(e.target, []);
      inc.get(e.target)!.push(e);
    }
    return { out, inc };
  }, [graph]);

  // Filter
  const filtered = useMemo(() => {
    let edges = graph.edges;
    if (filters.resource) edges = edges.filter((e) => e.resource === filters.resource);
    if (filters.primaryOnly) edges = edges.filter((e) => e.priority === 1);

    const edgeNodeIds = new Set<string>();
    for (const e of edges) { edgeNodeIds.add(e.source); edgeNodeIds.add(e.target); }

    let nodes = graph.nodes.filter((n) => {
      if ((filters.resource || filters.primaryOnly) && !edgeNodeIds.has(n.id)) return false;
      if (filters.cluster && n.cluster !== filters.cluster) return false;
      if (filters.toolkit !== "all" && n.toolkit !== filters.toolkit) return false;
      if (filters.category !== "all" && n.category !== filters.category) return false;
      if (filters.search && !n.id.toLowerCase().includes(filters.search.toLowerCase()) && !n.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [graph, filters]);

  // Compute DAG layout
  const layout = useMemo(() => {
    const { nodes, edges } = filtered;
    if (nodes.length === 0) return { nodes: [], links: [], columns: new Map<number, LayoutNode[]>(), clusterBounds: [] };

    // Build adjacency for filtered graph
    const outEdges = new Map<string, string[]>();
    for (const e of edges) {
      if (!outEdges.has(e.source)) outEdges.set(e.source, []);
      outEdges.get(e.source)!.push(e.target);
    }

    const depth = new Map<string, number>();
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const id of nodeIds) depth.set(id, 0);

    let changed = true;
    for (let iter = 0; iter < 20 && changed; iter++) {
      changed = false;
      for (const e of edges) {
        const td = depth.get(e.target) || 0;
        const sd = depth.get(e.source) || 0;
        if (sd < td + 1) { depth.set(e.source, td + 1); changed = true; }
      }
    }

    const maxDepth = Math.max(0, ...depth.values());

    const clusters = [...new Set(nodes.map((n) => n.cluster))];
    clusters.sort((a, b) => {
      const aKit = nodes.find((n) => n.cluster === a)?.toolkit || "";
      const bKit = nodes.find((n) => n.cluster === b)?.toolkit || "";
      if (aKit !== bKit) return aKit === "googlesuper" ? -1 : 1;
      return a.localeCompare(b);
    });

    const COL_WIDTH = 220;
    const ROW_HEIGHT = 28;
    const CLUSTER_GAP = 50;
    const HEADER_HEIGHT = 30;
    const LEFT_PAD = 120;
    const TOP_PAD = 70;

    const clusterLanes = new Map<string, number>();
    let currentY = TOP_PAD;

    for (const cl of clusters) {
      clusterLanes.set(cl, currentY);
      const clusterNodes = nodes.filter((n) => n.cluster === cl);
      const colCounts = new Map<number, number>();
      for (const n of clusterNodes) {
        const col = depth.get(n.id) || 0;
        colCounts.set(col, (colCounts.get(col) || 0) + 1);
      }
      const maxRows = Math.max(1, ...colCounts.values());
      currentY += HEADER_HEIGHT + maxRows * ROW_HEIGHT + 10 + CLUSTER_GAP;
    }

    // Place nodes
    const conn = new Map<string, number>();
    for (const n of nodes) {
      const o = (adjacency.out.get(n.id) || []).length;
      const i = (adjacency.inc.get(n.id) || []).length;
      conn.set(n.id, o + i);
    }
    const maxConn = Math.max(1, ...conn.values());

    const colClusterRowCount = new Map<string, number>();
    const layoutNodes: LayoutNode[] = [];

    for (const n of nodes) {
      const col = depth.get(n.id) || 0;
      const clY = clusterLanes.get(n.cluster) || TOP_PAD;
      const key = `${col}:${n.cluster}`;
      const row = colClusterRowCount.get(key) || 0;
      colClusterRowCount.set(key, row + 1);
      const c = conn.get(n.id) || 1;
      layoutNodes.push({
        ...n,
        x: LEFT_PAD + col * COL_WIDTH,
        y: clY + HEADER_HEIGHT + row * ROW_HEIGHT,
        col, row,
        r: 4 + (c / maxConn) * 8,
      });
    }

    const nodeById = new Map(layoutNodes.map((n) => [n.id, n]));
    const layoutLinks: LayoutLink[] = edges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        source: nodeById.get(e.source)!,
        target: nodeById.get(e.target)!,
        param: e.param, resource: e.resource, priority: e.priority,
        reason: e.reason, userProvidable: e.userProvidable,
      }));

    const columns = new Map<number, LayoutNode[]>();
    for (const n of layoutNodes) {
      if (!columns.has(n.col)) columns.set(n.col, []);
      columns.get(n.col)!.push(n);
    }

    // Compute cluster bounds for nav
    const bounds: ClusterBounds[] = [];
    for (const cl of clusters) {
      const clNodes = layoutNodes.filter((n) => n.cluster === cl);
      if (clNodes.length === 0) continue;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of clNodes) {
        minX = Math.min(minX, n.x - 20);
        maxX = Math.max(maxX, n.x + 180);
        minY = Math.min(minY, n.y - 16);
        maxY = Math.max(maxY, n.y + 16);
      }
      bounds.push({
        cluster: cl,
        toolkit: clNodes[0].toolkit,
        minX, maxX, minY, maxY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        count: clNodes.length,
      });
    }

    return { nodes: layoutNodes, links: layoutLinks, columns, clusterBounds: bounds };
  }, [filtered, adjacency]);

  useEffect(() => {
    layoutRef.current = layout;
    setClusterBounds(layout.clusterBounds);
  }, [layout]);

  const drawRef = useRef<() => void>(() => {});

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const lay = layoutRef.current;
    if (!canvas || !lay) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = transformRef.current;
    const sel = selectedNode;
    const hCluster = lockedCluster || hoveredCluster;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const { nodes, links, columns } = lay;

    const connSet = new Set<string>();
    if (sel) {
      connSet.add(sel);
      for (const l of links) {
        if (l.source.id === sel) connSet.add(l.target.id);
        if (l.target.id === sel) connSet.add(l.source.id);
      }
    }

    // Column headers
    const maxCol = Math.max(0, ...columns.keys());
    const colLabels = ["Producers", "Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5", "Tier 6"];
    for (let col = 0; col <= maxCol; col++) {
      const x = 120 + col * 220;
      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "#3a3a5e";
      ctx.textAlign = "center";
      ctx.fillText(colLabels[col] || `Tier ${col}`, x, 50);
      ctx.beginPath();
      ctx.moveTo(x, 58);
      ctx.lineTo(x, Math.max(800, nodes.length * 5));
      ctx.strokeStyle = "#0f0f1a";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cluster bands
    for (const b of lay.clusterBounds) {
      const isHovered = hCluster === b.cluster;
      const cl = b.cluster;
      const color = CLUSTER_COLORS[cl] || "#666";

      // Band background
      ctx.fillStyle = color + (isHovered ? "15" : "08");
      ctx.fillRect(b.minX - 80, b.minY - 8, b.maxX - b.minX + 100, b.maxY - b.minY + 16);

      // Left border accent
      ctx.fillStyle = color + (isHovered ? "60" : "25");
      ctx.fillRect(b.minX - 82, b.minY - 8, 3, b.maxY - b.minY + 16);

      // Cluster label
      ctx.font = isHovered ? "bold 11px system-ui" : "bold 10px system-ui";
      ctx.fillStyle = color + (isHovered ? "e0" : "90");
      ctx.textAlign = "right";
      ctx.fillText(cl, b.minX - 10, (b.minY + b.maxY) / 2 + 4);

      // Count badge
      ctx.font = "9px system-ui";
      ctx.fillStyle = color + "50";
      ctx.fillText(`${b.count} tools`, b.minX - 10, (b.minY + b.maxY) / 2 + 16);

      // Top divider
      ctx.beginPath();
      ctx.moveTo(b.minX - 82, b.minY - 8);
      ctx.lineTo(b.maxX + 20, b.minY - 8);
      ctx.strokeStyle = color + (isHovered ? "30" : "12");
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Edges
    for (const l of links) {
      const s = l.source;
      const tgt = l.target;
      const isSrcSel = sel && s.id === sel;
      const isTgtSel = sel && tgt.id === sel;
      const isHL = isSrcSel || isTgtSel;
      const inHovCluster = hCluster && (s.cluster === hCluster || tgt.cluster === hCluster);

      if (sel && !isHL) {
        ctx.globalAlpha = 0.03; ctx.strokeStyle = "#111"; ctx.lineWidth = 0.3;
      } else if (isSrcSel) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = PRIORITY_COLORS[l.priority] || "#34d399";
        ctx.lineWidth = l.priority === 1 ? 2.5 : l.priority === 2 ? 1.5 : 1;
      } else if (isTgtSel) {
        ctx.globalAlpha = 0.85; ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2;
      } else if (hCluster && !inHovCluster) {
        ctx.globalAlpha = 0.03; ctx.strokeStyle = "#111"; ctx.lineWidth = 0.2;
      } else {
        ctx.globalAlpha = inHovCluster ? 0.35 : 0.12;
        ctx.strokeStyle = PRIORITY_COLORS[l.priority] || "#333";
        ctx.lineWidth = l.priority === 1 ? 0.6 : 0.3;
      }

      if (l.priority === 3) ctx.setLineDash([3, 3]);
      const dx = tgt.x - s.x;
      const cpOffset = Math.abs(dx) * 0.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.bezierCurveTo(s.x - cpOffset, s.y, tgt.x + cpOffset, tgt.y, tgt.x, tgt.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      if (isHL) {
        const angle = Math.atan2(tgt.y - s.y, tgt.x - s.x);
        const ar = tgt.r + 4;
        ctx.save();
        ctx.translate(tgt.x + ar * Math.cos(angle + Math.PI), tgt.y + ar * Math.sin(angle + Math.PI));
        ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.closePath();
        ctx.fillStyle = isSrcSel ? (PRIORITY_COLORS[l.priority] || "#34d399") : "#f87171";
        ctx.fill(); ctx.restore();

        const mx = (s.x + tgt.x) / 2, my = (s.y + tgt.y) / 2;
        ctx.font = "6px monospace"; ctx.fillStyle = "#666"; ctx.textAlign = "center";
        ctx.fillText(l.param, mx, my - 5);
      }
    }

    // Nodes
    for (const n of nodes) {
      const dimmed = sel ? !connSet.has(n.id) : (hCluster ? n.cluster !== hCluster : false);
      const alpha = dimmed ? 0.06 : 0.9;
      const isHov = hoverRef.current === n.id;
      const isSel = sel === n.id;
      const r = isHov ? n.r + 2 : n.r;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = CAT_COLORS[n.category] || "#94a3b8";
      ctx.fill();

      const hasUserProv = graph.edges.some((e) => e.source === n.id && e.userProvidable);
      if (hasUserProv && !dimmed) {
        ctx.setLineDash([2, 2]); ctx.strokeStyle = "#a78bfa";
      } else {
        ctx.setLineDash([]); ctx.strokeStyle = TOOLKIT_COLORS[n.toolkit] || "#666";
      }
      ctx.lineWidth = isSel ? 3 : isHov ? 2.5 : 1.2;
      ctx.stroke(); ctx.setLineDash([]);

      if (isSel) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#8b5cf680"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (!dimmed) {
        const label = shortSlug(n.id);
        const displayLabel = label.length > 22 ? label.substring(0, 22) + "…" : label;
        ctx.font = isSel ? "bold 8px monospace" : "7px monospace";
        ctx.fillStyle = "#999"; ctx.textAlign = "left";
        ctx.fillText(displayLabel, n.x + r + 5, n.y + 3);
      }
    }

    ctx.restore();
  }, [selectedNode, graph, adjacency, hoveredCluster, lockedCluster]);

  // Keep drawRef in sync
  drawRef.current = draw;

  // Animated zoom helper
  const animateZoom = useCallback((tx: number, ty: number, tk: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = { x: transformRef.current.x, y: transformRef.current.y, k: transformRef.current.k };
    const duration = 600;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const cx = start.x + (tx - start.x) * e;
      const cy = start.y + (ty - start.y) * e;
      const ck = start.k + (tk - start.k) * e;
      const newT = d3.zoomIdentity.translate(cx, cy).scale(ck);
      transformRef.current = newT;
      (canvas as any).__zoom = newT;
      drawRef.current();
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, []);

  // Zoom to cluster
  const zoomToCluster = useCallback((cluster: string) => {
    const canvas = canvasRef.current;
    const lay = layoutRef.current;
    if (!canvas || !lay) return;

    const b = lay.clusterBounds.find((c) => c.cluster === cluster);
    if (!b) return;

    const w = canvas.width;
    const h = canvas.height;
    const pad = 60;
    const k = Math.min(2, w / (b.maxX - b.minX + pad * 2), h / (b.maxY - b.minY + pad * 2));
    const ttx = w / 2 - b.cx * k;
    const tty = h / 2 - b.cy * k;

    animateZoom(ttx, tty, k);
  }, [animateZoom]);

  const zoomToFit = useCallback(() => {
    const canvas = canvasRef.current;
    const lay = layoutRef.current;
    if (!canvas || !lay || lay.nodes.length === 0) return;

    const w = canvas.width;
    const h = canvas.height;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of lay.nodes) {
      minX = Math.min(minX, n.x - 100);
      maxX = Math.max(maxX, n.x + 180);
      minY = Math.min(minY, n.y - 20);
      maxY = Math.max(maxY, n.y + 20);
    }
    const pad = 40;
    const k = Math.min(1.5, w / (maxX - minX + pad * 2), h / (maxY - minY + pad * 2));
    const ttx = pad - minX * k;
    const tty = pad - minY * k;

    animateZoom(ttx, tty, k);
  }, [animateZoom]);

  // Setup canvas + zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.parentElement!.clientWidth;
    const h = canvas.parentElement!.clientHeight;
    canvas.width = w; canvas.height = h;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 5])
      .on("zoom", (event) => { transformRef.current = event.transform; draw(); });

    zoomRef.current = zoom;
    const d3Canvas = d3.select(canvas);
    d3Canvas.call(zoom as any);

    // Auto fit on mount
    setTimeout(() => zoomToFit(), 100);

    function getNodeAt(mx: number, my: number) {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k, y = (my - t.y) / t.k;
      const lay = layoutRef.current;
      if (!lay) return null;
      for (let i = lay.nodes.length - 1; i >= 0; i--) {
        const n = lay.nodes[i];
        if ((x - n.x) ** 2 + (y - n.y) ** 2 < (n.r + 6) ** 2) return n;
      }
      for (const n of lay.nodes) {
        if (x >= n.x + n.r && x <= n.x + n.r + shortSlug(n.id).length * 5 + 10 && Math.abs(y - n.y) < 8) return n;
      }
      return null;
    }

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      const prev = hoverRef.current;
      hoverRef.current = n?.id || null;
      canvas.style.cursor = n ? "pointer" : "grab";
      if (prev !== hoverRef.current) draw();
    });

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      onSelectNode(n?.id || null);
    });

    draw();
  }, [layout, draw, onSelectNode]);

  useEffect(() => { draw(); }, [selectedNode, draw, hoveredCluster, lockedCluster]);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas?.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      draw();
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Minimap */}
      <div className="absolute bottom-3 left-3 z-20 bg-[#0c0c14]/95 border border-[#1a1a2e] rounded-lg p-2 backdrop-blur-md">
        <div className="text-[8px] text-zinc-700 uppercase tracking-wider mb-1">Minimap</div>
        <MiniMap
          clusterBounds={clusterBounds}
          transform={transformRef.current}
          canvasWidth={canvasRef.current?.width || 800}
          canvasHeight={canvasRef.current?.height || 600}
          onClickCluster={zoomToCluster}
        />
      </div>
    </div>
  );
}

function MiniMap({
  clusterBounds,
  transform,
  canvasWidth,
  canvasHeight,
  onClickCluster,
}: {
  clusterBounds: ClusterBounds[];
  transform: d3.ZoomTransform;
  canvasWidth: number;
  canvasHeight: number;
  onClickCluster: (cluster: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || clusterBounds.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mW = 180, mH = 100;
    canvas.width = mW; canvas.height = mH;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const b of clusterBounds) {
      minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
    }

    const pad = 10;
    const s = Math.min(mW / (maxX - minX + pad * 2), mH / (maxY - minY + pad * 2));

    ctx.clearRect(0, 0, mW, mH);
    ctx.fillStyle = "#08080c";
    ctx.fillRect(0, 0, mW, mH);

    // Draw cluster rects
    for (const b of clusterBounds) {
      const rx = (b.minX - minX + pad) * s;
      const ry = (b.minY - minY + pad) * s;
      const rw = (b.maxX - b.minX) * s;
      const rh = (b.maxY - b.minY) * s;

      ctx.fillStyle = (CLUSTER_COLORS[b.cluster] || "#666") + "30";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = (CLUSTER_COLORS[b.cluster] || "#666") + "60";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(rx, ry, rw, rh);

      if (rw > 20) {
        ctx.font = "6px system-ui";
        ctx.fillStyle = (CLUSTER_COLORS[b.cluster] || "#666") + "90";
        ctx.textAlign = "center";
        ctx.fillText(b.cluster, rx + rw / 2, ry + rh / 2 + 2);
      }
    }

    // Viewport rect
    const vx = (-transform.x / transform.k - minX + pad) * s;
    const vy = (-transform.y / transform.k - minY + pad) * s + (transform.y > 0 ? 0 : 0);
    const vw = (canvasWidth / transform.k) * s;
    const vh = (canvasHeight / transform.k) * s;
    ctx.strokeStyle = "rgba(139,92,246,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      (-transform.x / transform.k - minX + pad) * s,
      (-transform.y / transform.k - minY + pad) * s,
      vw, vh
    );
  }, [clusterBounds, transform, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={ref}
      className="cursor-pointer rounded"
      style={{ width: 180, height: 100 }}
      onClick={(e) => {
        // Find which cluster was clicked
        if (clusterBounds.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const b of clusterBounds) {
          minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
          minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
        }
        const worldX = minX + mx * (maxX - minX);
        const worldY = minY + my * (maxY - minY);

        for (const b of clusterBounds) {
          if (worldX >= b.minX && worldX <= b.maxX && worldY >= b.minY && worldY <= b.maxY) {
            onClickCluster(b.cluster);
            return;
          }
        }
      }}
    />
  );
}
