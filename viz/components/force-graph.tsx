"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import * as d3 from "d3";
import type { GraphData, FilterState, GraphEdge } from "@/lib/types";
import {
  CAT_COLORS,
  TOOLKIT_COLORS,
  PRIORITY_COLORS,
  CLUSTER_COLORS,
  shortSlug,
} from "@/lib/constants";

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  toolkit: string;
  category: string;
  cluster: string;
  description: string;
  requiredParams: string[];
  _r: number;
};

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  param: string;
  resource: string;
  priority: number;
  reason: string;
  userProvidable: boolean;
};

export function ForceGraph({
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
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const camRef = useRef({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(d3.zoomIdentity);
  const hoverRef = useRef<string | null>(null);

  // Build adjacency for highlight
  const adjacency = useMemo(() => {
    const out = new Map<string, GraphEdge[]>();
    const inc = new Map<string, GraphEdge[]>();
    for (const e of graph.edges) {
      if (!out.has(e.source)) out.set(e.source, []);
      out.get(e.source)!.push(e);
      if (!inc.has(e.target)) inc.set(e.target, []);
      inc.get(e.target)!.push(e);
    }
    return { out, inc };
  }, [graph]);

  // Filter data
  const filtered = useMemo(() => {
    let edges = graph.edges;
    if (filters.resource)
      edges = edges.filter((e) => e.resource === filters.resource);
    if (filters.primaryOnly) edges = edges.filter((e) => e.priority === 1);

    const edgeNodeIds = new Set<string>();
    for (const e of edges) {
      edgeNodeIds.add(e.source);
      edgeNodeIds.add(e.target);
    }

    let nodes = graph.nodes.filter((n) => {
      if ((filters.resource || filters.primaryOnly) && !edgeNodeIds.has(n.id))
        return false;
      if (filters.cluster && n.cluster !== filters.cluster) return false;
      if (filters.toolkit !== "all" && n.toolkit !== filters.toolkit)
        return false;
      if (filters.category !== "all" && n.category !== filters.category)
        return false;
      if (
        filters.search &&
        !n.id.toLowerCase().includes(filters.search.toLowerCase()) &&
        !n.description.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return { nodes, edges };
  }, [graph, filters]);

  // Connectivity for node sizing
  const connectivity = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph.nodes) {
      const o = (adjacency.out.get(n.id) || []).length;
      const i = (adjacency.inc.get(n.id) || []).length;
      m.set(n.id, o + i);
    }
    return m;
  }, [graph, adjacency]);

  const maxConn = useMemo(
    () => Math.max(1, ...connectivity.values()),
    [connectivity]
  );

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = transformRef.current;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const sel = selectedNode;

    // Connected set for highlight
    const connSet = new Set<string>();
    if (sel) {
      connSet.add(sel);
      for (const l of links) {
        const sid = typeof l.source === "object" ? (l.source as SimNode).id : String(l.source);
        const tid = typeof l.target === "object" ? (l.target as SimNode).id : String(l.target);
        if (sid === sel) connSet.add(tid);
        if (tid === sel) connSet.add(sid);
      }
    }

    // Cluster hulls
    if (!sel && nodes.length > 10) {
      const clusterMap = new Map<string, SimNode[]>();
      for (const n of nodes) {
        if (!clusterMap.has(n.cluster)) clusterMap.set(n.cluster, []);
        clusterMap.get(n.cluster)!.push(n);
      }
      for (const [cl, cns] of clusterMap) {
        if (cns.length < 3) continue;
        let cx = 0,
          cy = 0;
        for (const n of cns) {
          cx += n.x!;
          cy += n.y!;
        }
        cx /= cns.length;
        cy /= cns.length;
        let maxR = 0;
        for (const n of cns) {
          const d =
            Math.sqrt((n.x! - cx) ** 2 + (n.y! - cy) ** 2) + n._r + 20;
          maxR = Math.max(maxR, d);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        const color = CLUSTER_COLORS[cl] || "#666";
        ctx.fillStyle = color + "06";
        ctx.fill();
        ctx.strokeStyle = color + "12";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "bold 9px system-ui";
        ctx.fillStyle = color + "50";
        ctx.textAlign = "center";
        ctx.fillText(cl, cx, cy - maxR - 5);
      }
    }

    // Edges
    for (const l of links) {
      const s = l.source as SimNode;
      const t2 = l.target as SimNode;
      if (!s.x || !t2.x) continue;

      const isSrcSel = sel && s.id === sel;
      const isTgtSel = sel && t2.id === sel;
      const isHL = isSrcSel || isTgtSel;

      if (sel && !isHL) {
        ctx.globalAlpha = 0.04;
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 0.3;
      } else if (isSrcSel) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = PRIORITY_COLORS[l.priority] || "#34d399";
        ctx.lineWidth = l.priority === 1 ? 2.5 : l.priority === 2 ? 1.5 : 1;
      } else if (isTgtSel) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 2;
      } else {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = PRIORITY_COLORS[l.priority] || "#333";
        ctx.lineWidth = l.priority === 1 ? 0.7 : 0.3;
      }

      ctx.beginPath();
      if (l.priority === 3) ctx.setLineDash([3, 3]);
      ctx.moveTo(s.x, s.y!);
      ctx.lineTo(t2.x, t2.y!);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Arrows + param labels on highlight
      if (isHL) {
        const dx = t2.x - s.x;
        const dy = t2.y! - s.y!;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const tr = t2._r + 5;
          const mx = t2.x - (dx / dist) * tr;
          const my = t2.y! - (dy / dist) * tr;
          const angle = Math.atan2(dy, dx);
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-7, -3.5);
          ctx.lineTo(-7, 3.5);
          ctx.closePath();
          ctx.fillStyle = isSrcSel
            ? PRIORITY_COLORS[l.priority] || "#34d399"
            : "#f87171";
          ctx.fill();
          ctx.restore();

          // Param label
          const lx = (s.x + t2.x) / 2;
          const ly = (s.y! + t2.y!) / 2;
          ctx.font = "6px monospace";
          ctx.fillStyle = "#777";
          ctx.textAlign = "center";
          ctx.fillText(l.param, lx, ly - 4);
        }
      }
    }

    // Nodes
    for (const n of nodes) {
      if (!n.x) continue;
      const r = n._r;
      const dimmed = sel && !connSet.has(n.id);
      const alpha = dimmed ? 0.06 : 0.9;
      const isHovered = hoverRef.current === n.id;

      ctx.beginPath();
      ctx.arc(n.x, n.y!, isHovered ? r + 2 : r, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = CAT_COLORS[n.category] || "#94a3b8";
      ctx.fill();

      const hasUserProv = graph.edges.some(
        (e) => e.source === n.id && e.userProvidable
      );
      if (hasUserProv && !dimmed) {
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = "#a78bfa";
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = TOOLKIT_COLORS[n.toolkit] || "#666";
      }
      ctx.lineWidth = sel && n.id === sel ? 3 : isHovered ? 2.5 : 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Glow for selected
      if (sel && n.id === sel) {
        ctx.beginPath();
        ctx.arc(n.x, n.y!, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#8b5cf680";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Labels
      const showLabel =
        r > 7 || (sel && connSet.has(n.id)) || nodes.length < 40 || isHovered;
      if (showLabel && !dimmed) {
        const label = shortSlug(n.id);
        const displayLabel =
          label.length > 28 ? label.substring(0, 28) + "…" : label;
        ctx.font =
          sel && n.id === sel
            ? "bold 8px monospace"
            : isHovered
              ? "bold 7px monospace"
              : "7px monospace";
        ctx.fillStyle = "#aaa";
        ctx.textAlign = "center";
        ctx.fillText(displayLabel, n.x, n.y! + r + 11);
      }
    }

    ctx.restore();
  }, [selectedNode, graph, adjacency, maxConn, connectivity]);

  // Setup simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.parentElement!.clientWidth;
    const h = canvas.parentElement!.clientHeight;
    canvas.width = w;
    canvas.height = h;

    // Build sim nodes
    const clusters = [...new Set(filtered.nodes.map((n) => n.cluster))];
    const clusterAngle = new Map(
      clusters.map((c, i) => [c, (i / clusters.length) * 2 * Math.PI])
    );

    const simNodes: SimNode[] = filtered.nodes.map((n) => {
      const angle = clusterAngle.get(n.cluster) || 0;
      const cr = Math.min(w, h) * 0.2;
      const conn = connectivity.get(n.id) || 1;
      return {
        ...n,
        x: w / 2 + cr * Math.cos(angle) + (Math.random() - 0.5) * 120,
        y: h / 2 + cr * Math.sin(angle) + (Math.random() - 0.5) * 120,
        _r: 3 + (conn / maxConn) * 12,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = filtered.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        param: e.param,
        resource: e.resource,
        priority: e.priority,
        reason: e.reason,
        userProvidable: e.userProvidable,
      }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // D3 force simulation — the "living breathing" part
    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            return s.cluster === t.cluster ? 40 : 90;
          })
          .strength((l) => (l.priority === 1 ? 0.3 : 0.1))
      )
      .force("charge", d3.forceManyBody().strength(-80).distanceMax(300))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.03))
      .force(
        "cluster",
        d3.forceRadial<SimNode>(
          Math.min(w, h) * 0.2,
          w / 2,
          h / 2
        ).strength((n) => 0.02)
      )
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d._r + 2))
      .alphaDecay(0.01)
      .velocityDecay(0.3)
      .on("tick", draw);

    simRef.current = sim;

    // Zoom
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 10])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    const d3Canvas = d3.select(canvas);
    d3Canvas.call(zoom as any);

    // Auto fit after warm up
    setTimeout(() => {
      if (simNodes.length === 0) return;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const n of simNodes) {
        minX = Math.min(minX, n.x!);
        maxX = Math.max(maxX, n.x!);
        minY = Math.min(minY, n.y!);
        maxY = Math.max(maxY, n.y!);
      }
      const pad = 80;
      const k = Math.min(
        2,
        w / (maxX - minX + pad * 2),
        h / (maxY - minY + pad * 2)
      );
      const tx = w / 2 - ((minX + maxX) / 2) * k;
      const ty = h / 2 - ((minY + maxY) / 2) * k;
      d3Canvas
        .transition()
        .duration(800)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(k));
    }, 2000);

    // Mouse interactions
    function getNodeAt(mx: number, my: number) {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = x - n.x!;
        const dy = y - n.y!;
        if (dx * dx + dy * dy < (n._r + 4) ** 2) return n;
      }
      return null;
    }

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      hoverRef.current = n?.id || null;
      canvas.style.cursor = n ? "pointer" : "grab";
    });

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      onSelectNode(n?.id || null);
    });

    // Drag nodes
    let dragTarget: SimNode | null = null;

    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (n) {
        dragTarget = n;
        sim.alphaTarget(0.3).restart();
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!dragTarget) return;
      const t = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      dragTarget.fx = (e.clientX - rect.left - t.x) / t.k;
      dragTarget.fy = (e.clientY - rect.top - t.y) / t.k;
    });

    const mouseUp = () => {
      if (dragTarget) {
        dragTarget.fx = null;
        dragTarget.fy = null;
        dragTarget = null;
        sim.alphaTarget(0);
      }
    };
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("mouseleave", mouseUp);

    // Keep alive — gentle breathing
    const breatheInterval = setInterval(() => {
      if (sim.alpha() < 0.01) {
        sim.alpha(0.02).restart();
      }
    }, 3000);

    return () => {
      sim.stop();
      clearInterval(breatheInterval);
    };
  }, [filtered, draw, connectivity, maxConn, onSelectNode]);

  // Redraw when selection changes
  useEffect(() => {
    draw();
  }, [selectedNode, draw]);

  // Resize
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      draw();
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
