import { readFileSync, writeFileSync } from "fs";

const graph = JSON.parse(readFileSync("./dependency_graph.json", "utf8"));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Composio Tool Dependency Graph</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: #08080c; color: #e0e0e0; overflow: hidden; }

  #controls {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: rgba(8,8,12,0.97); border-bottom: 1px solid #1a1a2e;
    padding: 10px 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    backdrop-filter: blur(12px);
  }
  #controls h1 { font-size: 15px; color: #a78bfa; margin-right: 8px; white-space: nowrap; font-weight: 600; }
  .ctrl-input {
    background: #12121e; border: 1px solid #2a2a4e; color: #e0e0e0;
    padding: 5px 10px; border-radius: 6px; font-size: 12px; outline: none;
    transition: border-color 0.2s;
  }
  .ctrl-input:focus { border-color: #8b5cf6; }
  #search { width: 220px; }
  .ctrl-select { min-width: 130px; cursor: pointer; }
  .stat { font-size: 11px; color: #666; margin-left: auto; white-space: nowrap; }
  .btn {
    background: #1a1a2e; border: 1px solid #2a2a4e; color: #aaa; padding: 5px 12px;
    border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;
  }
  .btn:hover { background: #2a1a4e; color: #c4b5fd; border-color: #8b5cf6; }
  .btn.active { background: #3b1a6e; color: #e9d5ff; border-color: #8b5cf6; }

  #tooltip {
    position: fixed; display: none; background: rgba(12,12,20,0.98);
    border: 1px solid #3a3a5e; border-radius: 10px; padding: 14px 18px;
    font-size: 12px; max-width: 480px; z-index: 200; pointer-events: none;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6); line-height: 1.6;
  }
  .tt-slug { font-size: 13px; font-weight: 700; color: #a78bfa; margin-bottom: 3px; word-break: break-all; }
  .tt-cluster { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .tt-desc { color: #999; margin-bottom: 8px; font-size: 11px; }
  .tt-section { margin-bottom: 6px; }
  .tt-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .tt-deps { color: #6ee7b7; font-size: 11px; }
  .tt-consumers { color: #fbbf24; font-size: 11px; }
  .tt-reason { color: #8b9dc3; font-size: 10px; font-style: italic; }
  .tt-badge {
    display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px;
    font-weight: 600; margin-right: 4px;
  }
  .tt-primary { background: #065f46; color: #6ee7b7; }
  .tt-alternative { background: #713f12; color: #fbbf24; }
  .tt-user { background: #1e1b4b; color: #a78bfa; }

  #legend {
    position: fixed; bottom: 16px; left: 16px; z-index: 100;
    background: rgba(8,8,12,0.97); border: 1px solid #1a1a2e;
    border-radius: 10px; padding: 14px 18px; font-size: 11px;
    backdrop-filter: blur(12px);
  }
  .leg-h { margin-bottom: 6px; color: #555; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .leg-item { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; color: #888; }
  .leg-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .leg-ring { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 2px solid; background: transparent; }

  #right-panel {
    position: fixed; top: 50px; right: 0; bottom: 0; width: 260px; z-index: 100;
    background: rgba(8,8,12,0.97); border-left: 1px solid #1a1a2e;
    display: flex; flex-direction: column; backdrop-filter: blur(12px);
  }
  .panel-tabs { display: flex; border-bottom: 1px solid #1a1a2e; }
  .panel-tab {
    flex: 1; padding: 8px; text-align: center; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.5px; color: #555; cursor: pointer; border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }
  .panel-tab:hover { color: #aaa; }
  .panel-tab.active { color: #a78bfa; border-bottom-color: #8b5cf6; }
  .panel-content { flex: 1; overflow-y: auto; padding: 10px 14px; }
  .panel-content::-webkit-scrollbar { width: 4px; }
  .panel-content::-webkit-scrollbar-thumb { background: #2a2a4e; border-radius: 2px; }

  .resource-btn {
    display: block; width: 100%; text-align: left; background: none; border: none;
    color: #888; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;
    margin-bottom: 1px; font-family: monospace; transition: all 0.15s;
  }
  .resource-btn:hover { background: #1a1a2e; color: #e0e0e0; }
  .resource-btn.active { background: #2a1a4e; color: #c4b5fd; }
  .resource-count { float: right; color: #444; font-size: 10px; }

  .cluster-btn {
    display: block; width: 100%; text-align: left; background: none; border: none;
    color: #888; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;
    margin-bottom: 1px; transition: all 0.15s;
  }
  .cluster-btn:hover { background: #1a1a2e; color: #e0e0e0; }
  .cluster-btn.active { background: #2a1a4e; color: #c4b5fd; }
  .cluster-count { float: right; color: #444; font-size: 10px; }

  #path-finder {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 100;
    background: rgba(8,8,12,0.97); border: 1px solid #1a1a2e; border-radius: 10px;
    padding: 12px 20px; display: none; backdrop-filter: blur(12px); max-width: 700px; width: 90%;
  }
  .path-title { font-size: 11px; color: #a78bfa; font-weight: 600; margin-bottom: 8px; }
  .path-chain {
    font-family: monospace; font-size: 11px; padding: 6px 10px; background: #0f0f1a;
    border-radius: 6px; margin-bottom: 4px; color: #e0e0e0; line-height: 1.6;
  }
  .path-arrow { color: #8b5cf6; }
  .path-param { color: #6ee7b7; font-size: 10px; }
  .path-close {
    position: absolute; top: 8px; right: 12px; background: none; border: none;
    color: #666; cursor: pointer; font-size: 16px;
  }

  #minimap {
    position: fixed; bottom: 16px; right: 276px; z-index: 100;
    background: rgba(8,8,12,0.9); border: 1px solid #1a1a2e; border-radius: 8px;
    overflow: hidden;
  }
  #minimap canvas { display: block; }
  .minimap-viewport {
    position: absolute; border: 1px solid rgba(139,92,246,0.5); pointer-events: none;
  }

  canvas#main { display: block; }
</style>
</head>
<body>

<div id="controls">
  <h1>Composio Dep Graph</h1>
  <input type="text" id="search" class="ctrl-input" placeholder="Search tools..." />
  <select id="toolkit-filter" class="ctrl-input ctrl-select">
    <option value="all">All Toolkits</option>
    <option value="googlesuper">Google Super</option>
    <option value="github">GitHub</option>
  </select>
  <select id="category-filter" class="ctrl-input ctrl-select">
    <option value="all">All Types</option>
    <option value="retriever">Retrievers</option>
    <option value="getter">Getters</option>
    <option value="creator">Creators</option>
    <option value="updater">Updaters</option>
    <option value="deleter">Deleters</option>
    <option value="action">Actions</option>
  </select>
  <button class="btn" id="btn-primary-only">Primary Only</button>
  <button class="btn" id="btn-fit">Fit View</button>
  <button class="btn" id="btn-path" title="Click a node to see its full execution plan">Path Finder</button>
  <span class="stat" id="stats"></span>
</div>

<div id="tooltip">
  <div class="tt-slug"></div>
  <div class="tt-cluster"></div>
  <div class="tt-desc"></div>
  <div class="tt-section"><div class="tt-label">Depends on</div><div class="tt-deps"></div></div>
  <div class="tt-section"><div class="tt-label">Depended by</div><div class="tt-consumers"></div></div>
</div>

<div id="legend">
  <div class="leg-h">Node Type</div>
  <div class="leg-item"><div class="leg-dot" style="background:#22d3ee"></div> Retriever (LIST/SEARCH)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#a78bfa"></div> Getter (GET)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#34d399"></div> Creator (CREATE/SEND)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#fbbf24"></div> Updater (UPDATE/PATCH)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#f87171"></div> Deleter (DELETE/REMOVE)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#94a3b8"></div> Action</div>
  <div class="leg-h" style="margin-top:8px">Edge Priority</div>
  <div class="leg-item"><div style="width:20px;height:2px;background:#34d399"></div> Primary (recommended)</div>
  <div class="leg-item"><div style="width:20px;height:2px;background:#fbbf24"></div> Alternative</div>
  <div class="leg-item"><div style="width:20px;height:1px;background:#555;border-top:1px dashed #555"></div> Indirect/circular</div>
  <div class="leg-h" style="margin-top:8px">Toolkit</div>
  <div class="leg-item"><div class="leg-ring" style="border-color:#4285f4"></div> Google Super</div>
  <div class="leg-item"><div class="leg-ring" style="border-color:#f0883e"></div> GitHub</div>
  <div style="color:#555;font-size:9px;margin-top:8px;line-height:1.4">Click = highlight deps<br>Scroll = zoom, Drag = pan<br>Dashed border = user-providable</div>
</div>

<div id="right-panel">
  <div class="panel-tabs">
    <div class="panel-tab active" data-tab="clusters">Clusters</div>
    <div class="panel-tab" data-tab="resources">Resources</div>
  </div>
  <div class="panel-content" id="panel-clusters"></div>
  <div class="panel-content" id="panel-resources" style="display:none"></div>
</div>

<div id="path-finder">
  <button class="path-close" id="path-close">&times;</button>
  <div class="path-title" id="path-title">Execution Plan</div>
  <div id="path-chains"></div>
</div>

<div id="minimap"><canvas id="minimap-canvas" width="160" height="100"></canvas></div>

<canvas id="main"></canvas>

<script>
const G = ${JSON.stringify(graph)};
const catColors = { retriever:"#22d3ee", getter:"#a78bfa", creator:"#34d399", updater:"#fbbf24", deleter:"#f87171", action:"#94a3b8" };
const tkStroke = { googlesuper:"#4285f4", github:"#f0883e" };
const prioColors = { 1:"#34d399", 2:"#fbbf24", 3:"#555" };
const clusterColors = {
  Gmail:"#ea4335", Calendar:"#4285f4", Drive:"#0ea5e9", Sheets:"#34a853", Docs:"#4285f4",
  Slides:"#fbbc05", Contacts:"#ea4335", Photos:"#a78bfa", Tasks:"#34a853",
  Issues:"#3fb950", "Pull Requests":"#a371f7", Comments:"#8b949e", Discussions:"#d29922",
  Git:"#f97583", Releases:"#79c0ff", "CI/CD":"#d29922", "Org & Teams":"#f97583",
  Deployments:"#79c0ff", Config:"#8b949e", Gists:"#3fb950", Projects:"#a371f7",
  Codespaces:"#56d364", Packages:"#da3633", Repos:"#f0883e", Other:"#666"
};

const canvas = document.getElementById("main");
const ctx = canvas.getContext("2d");
const mmCanvas = document.getElementById("minimap-canvas");
const mmCtx = mmCanvas.getContext("2d");
const tooltip = document.getElementById("tooltip");
const pathFinder = document.getElementById("path-finder");

let W = window.innerWidth - 260, H = window.innerHeight;
canvas.width = W; canvas.height = H;
canvas.style.width = W + "px";

// Adjacency
const outE = new Map(), inE = new Map();
for (const e of G.edges) {
  if (!outE.has(e.source)) outE.set(e.source, []);
  outE.get(e.source).push(e);
  if (!inE.has(e.target)) inE.set(e.target, []);
  inE.get(e.target).push(e);
}

// State
let nodes=[], links=[], nodeById=new Map();
let highlightId=null, pathMode=false, primaryOnly=false;
let cam={x:0,y:0,zoom:1};
let dragging=false, dragNode=null, lastM={x:0,y:0};
let activeResource=null, activeCluster=null;

// Panel setup
const panelTabs = document.querySelectorAll(".panel-tab");
panelTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    panelTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel-clusters").style.display = tab.dataset.tab==="clusters"?"block":"none";
    document.getElementById("panel-resources").style.display = tab.dataset.tab==="resources"?"block":"none";
  });
});

// Cluster panel
const clusterCounts = new Map();
for (const n of G.nodes) clusterCounts.set(n.cluster, (clusterCounts.get(n.cluster)||0)+1);
const sortedClusters = [...clusterCounts.entries()].sort((a,b)=>b[1]-a[1]);
const panelClusters = document.getElementById("panel-clusters");

const allClusterBtn = document.createElement("button");
allClusterBtn.className = "cluster-btn";
allClusterBtn.innerHTML = 'All Clusters <span class="cluster-count">' + G.nodes.length + '</span>';
allClusterBtn.onclick = () => { activeCluster=null; rebuild(); };
panelClusters.appendChild(allClusterBtn);

for (const [cl,cnt] of sortedClusters) {
  const btn = document.createElement("button");
  btn.className = "cluster-btn";
  const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+(clusterColors[cl]||'#666')+';margin-right:6px"></span>';
  btn.innerHTML = dot + cl + ' <span class="cluster-count">' + cnt + '</span>';
  btn.onclick = () => { activeCluster = activeCluster===cl?null:cl; rebuild(); };
  panelClusters.appendChild(btn);
}

// Resource panel
const resCounts = new Map();
for (const e of G.edges) resCounts.set(e.resource, (resCounts.get(e.resource)||0)+1);
const sortedRes = [...resCounts.entries()].sort((a,b)=>b[1]-a[1]);
const panelRes = document.getElementById("panel-resources");

const allResBtn = document.createElement("button");
allResBtn.className = "resource-btn";
allResBtn.innerHTML = 'All <span class="resource-count">' + G.edges.length + '</span>';
allResBtn.onclick = () => { activeResource=null; rebuild(); };
panelRes.appendChild(allResBtn);

for (const [res,cnt] of sortedRes) {
  const btn = document.createElement("button");
  btn.className = "resource-btn";
  btn.innerHTML = res + ' <span class="resource-count">' + cnt + '</span>';
  btn.onclick = () => { activeResource = activeResource===res?null:res; rebuild(); };
  panelRes.appendChild(btn);
}

// Buttons
document.getElementById("btn-primary-only").onclick = function() {
  primaryOnly = !primaryOnly;
  this.classList.toggle("active");
  rebuild();
};
document.getElementById("btn-fit").onclick = fitView;
document.getElementById("btn-path").onclick = function() {
  pathMode = !pathMode;
  this.classList.toggle("active");
  if (!pathMode) pathFinder.style.display = "none";
};
document.getElementById("path-close").onclick = () => { pathFinder.style.display="none"; };

function rebuild() {
  const tk = document.getElementById("toolkit-filter").value;
  const cat = document.getElementById("category-filter").value;
  const search = document.getElementById("search").value.toLowerCase();

  let filteredEdges = G.edges;
  if (activeResource) filteredEdges = filteredEdges.filter(e => e.resource === activeResource);
  if (primaryOnly) filteredEdges = filteredEdges.filter(e => e.priority === 1);

  const edgeNodeIds = new Set();
  for (const e of filteredEdges) { edgeNodeIds.add(e.source); edgeNodeIds.add(e.target); }

  let filteredNodes = G.nodes.filter(n => {
    if ((activeResource || primaryOnly) && !edgeNodeIds.has(n.id)) return false;
    if (activeCluster && n.cluster !== activeCluster) return false;
    if (tk !== "all" && n.toolkit !== tk) return false;
    if (cat !== "all" && n.category !== cat) return false;
    if (search && !n.id.toLowerCase().includes(search) && !n.description.toLowerCase().includes(search)) return false;
    return true;
  });

  const nodeIds = new Set(filteredNodes.map(n => n.id));
  filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  document.getElementById("stats").textContent =
    filteredNodes.length + " tools | " + filteredEdges.length + " deps | " +
    new Set(filteredEdges.map(e=>e.resource)).size + " resources";

  // Cluster-based initial positions
  const clusterCenters = new Map();
  const uniqueClusters = [...new Set(filteredNodes.map(n=>n.cluster))];
  const clusterAngleStep = (2*Math.PI) / Math.max(1, uniqueClusters.length);
  uniqueClusters.forEach((cl, i) => {
    const angle = i * clusterAngleStep;
    const r = Math.min(W,H) * 0.25;
    clusterCenters.set(cl, { x: W/2 + r*Math.cos(angle), y: H/2 + r*Math.sin(angle) });
  });

  nodes = filteredNodes.map((n, i) => {
    const center = clusterCenters.get(n.cluster) || {x:W/2,y:H/2};
    const spread = 60 + Math.random()*40;
    const a = Math.random()*2*Math.PI;
    return { ...n, x: center.x + spread*Math.cos(a), y: center.y + spread*Math.sin(a), vx:0, vy:0 };
  });
  nodeById = new Map(nodes.map(n=>[n.id,n]));
  links = filteredEdges.map(e => ({
    source: nodeById.get(e.source), target: nodeById.get(e.target),
    param:e.param, resource:e.resource, priority:e.priority, reason:e.reason, userProvidable:e.userProvidable
  })).filter(l => l.source && l.target);

  // Connectivity for sizing
  const conn = new Map();
  for (const n of nodes) {
    const o = (outE.get(n.id)||[]).length;
    const ic = (inE.get(n.id)||[]).length;
    conn.set(n.id, o+ic);
  }
  const maxConn = Math.max(1, ...conn.values());
  for (const n of nodes) n._r = 3 + (conn.get(n.id)/maxConn)*12;

  // Force sim
  for (let iter=0; iter<250; iter++) {
    // Center + cluster gravity
    for (const n of nodes) {
      const cc = clusterCenters.get(n.cluster) || {x:W/2,y:H/2};
      n.vx += (cc.x - n.x) * 0.003;
      n.vy += (cc.y - n.y) * 0.003;
      n.vx += (W/2 - n.x) * 0.0002;
      n.vy += (H/2 - n.y) * 0.0002;
    }

    // Repulsion (grid-based)
    const cellSize = 60;
    const grid = new Map();
    for (const n of nodes) {
      const key = (n.x/cellSize|0)+","+(n.y/cellSize|0);
      if (!grid.has(key)) grid.set(key,[]);
      grid.get(key).push(n);
    }
    for (const n of nodes) {
      const cx=n.x/cellSize|0, cy=n.y/cellSize|0;
      for (let dx=-2;dx<=2;dx++) for (let dy=-2;dy<=2;dy++) {
        const nb = grid.get((cx+dx)+","+(cy+dy));
        if (!nb) continue;
        for (const m of nb) {
          if (m===n) continue;
          const ddx=m.x-n.x, ddy=m.y-n.y;
          const d2 = ddx*ddx+ddy*ddy;
          if (d2 < 1) continue;
          const dist = Math.sqrt(d2);
          const f = 400/(d2);
          n.vx -= ddx/dist*f; n.vy -= ddy/dist*f;
        }
      }
    }

    // Link attraction
    for (const l of links) {
      const dx=l.target.x-l.source.x, dy=l.target.y-l.source.y;
      const dist = Math.max(1,Math.sqrt(dx*dx+dy*dy));
      const idealDist = l.source.cluster === l.target.cluster ? 40 : 80;
      const f = (dist-idealDist)*0.003;
      l.source.vx += dx/dist*f; l.source.vy += dy/dist*f;
      l.target.vx -= dx/dist*f; l.target.vy -= dy/dist*f;
    }

    for (const n of nodes) {
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
    }
  }

  highlightId = null;
  fitView();
}

function fitView() {
  if (nodes.length===0) { draw(); return; }
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for (const n of nodes) {
    minX=Math.min(minX,n.x); maxX=Math.max(maxX,n.x);
    minY=Math.min(minY,n.y); maxY=Math.max(maxY,n.y);
  }
  const pad = 80;
  cam.zoom = Math.min(2, W/(maxX-minX+pad*2), H/(maxY-minY+pad*2));
  cam.x = (minX+maxX)/2 - W/2;
  cam.y = (minY+maxY)/2 - H/2;
  draw();
}

function draw() {
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(W/2,H/2);
  ctx.scale(cam.zoom,cam.zoom);
  ctx.translate(-cam.x-W/2, -cam.y-H/2);

  const connSet = new Set();
  if (highlightId) {
    connSet.add(highlightId);
    for (const l of links) {
      if (l.source.id===highlightId) connSet.add(l.target.id);
      if (l.target.id===highlightId) connSet.add(l.source.id);
    }
  }

  // Cluster background hulls
  if (!highlightId && nodes.length > 10) {
    const clusterNodes = new Map();
    for (const n of nodes) {
      if (!clusterNodes.has(n.cluster)) clusterNodes.set(n.cluster,[]);
      clusterNodes.get(n.cluster).push(n);
    }
    for (const [cl,cns] of clusterNodes) {
      if (cns.length < 3) continue;
      let cx=0,cy=0;
      for (const n of cns) { cx+=n.x; cy+=n.y; }
      cx/=cns.length; cy/=cns.length;
      let maxR=0;
      for (const n of cns) {
        const d = Math.sqrt((n.x-cx)**2+(n.y-cy)**2) + n._r + 15;
        maxR = Math.max(maxR, d);
      }
      ctx.beginPath();
      ctx.arc(cx,cy,maxR,0,Math.PI*2);
      ctx.fillStyle = (clusterColors[cl]||"#666") + "08";
      ctx.fill();
      ctx.strokeStyle = (clusterColors[cl]||"#666") + "15";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Cluster label
      ctx.font = "bold 9px system-ui";
      ctx.fillStyle = (clusterColors[cl]||"#666") + "60";
      ctx.textAlign = "center";
      ctx.fillText(cl, cx, cy - maxR - 4);
    }
  }

  // Edges
  for (const l of links) {
    const isHighlightSource = highlightId && l.source.id===highlightId;
    const isHighlightTarget = highlightId && l.target.id===highlightId;
    const isHighlighted = isHighlightSource || isHighlightTarget;

    if (highlightId && !isHighlighted) {
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 0.3;
    } else if (isHighlightSource) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = prioColors[l.priority] || "#34d399";
      ctx.lineWidth = l.priority===1 ? 2.5 : l.priority===2 ? 1.5 : 1;
    } else if (isHighlightTarget) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2;
    } else {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = prioColors[l.priority] || "#333";
      ctx.lineWidth = l.priority===1 ? 0.8 : 0.4;
    }

    ctx.beginPath();
    if (l.priority === 3) {
      ctx.setLineDash([3,3]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(l.source.x, l.source.y);
    ctx.lineTo(l.target.x, l.target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Arrow for highlighted
    if (isHighlighted) {
      const dx=l.target.x-l.source.x, dy=l.target.y-l.source.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (dist < 1) continue;
      const tr = l.target._r || 5;
      const mx = l.target.x-(dx/dist)*(tr+5);
      const my = l.target.y-(dy/dist)*(tr+5);
      const angle = Math.atan2(dy,dx);
      ctx.save();
      ctx.translate(mx,my); ctx.rotate(angle);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-7,-3.5); ctx.lineTo(-7,3.5); ctx.closePath();
      ctx.fillStyle = isHighlightSource ? (prioColors[l.priority]||"#34d399") : "#f87171";
      ctx.fill();
      ctx.restore();

      // Edge label (param name)
      const lx = (l.source.x+l.target.x)/2, ly = (l.source.y+l.target.y)/2;
      ctx.font = "7px monospace";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText(l.param, lx, ly-4);
    }
  }

  // Nodes
  for (const n of nodes) {
    const r = n._r||5;
    const dimmed = highlightId && !connSet.has(n.id);
    const alpha = dimmed ? 0.08 : 0.9;

    // User-providable: dashed border
    const isUserProv = G.edges.some(e => e.source===n.id && e.userProvidable);

    ctx.beginPath();
    ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = catColors[n.category]||"#94a3b8";
    ctx.fill();

    if (isUserProv && !dimmed) {
      ctx.setLineDash([2,2]);
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1.5;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = tkStroke[n.toolkit]||"#666";
      ctx.lineWidth = highlightId && n.id===highlightId ? 3 : 1.5;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Labels
    const showLabel = r>7 || (highlightId && connSet.has(n.id)) || nodes.length<40;
    if (showLabel && !dimmed) {
      const label = n.id.replace(/^(GOOGLESUPER_|GITHUB_)/,"");
      ctx.font = (highlightId && n.id===highlightId) ? "bold 8px monospace" : "7px monospace";
      ctx.fillStyle = dimmed ? "rgba(136,136,136,0.05)" : "#aaa";
      ctx.textAlign = "center";
      ctx.fillText(label.length>25 ? label.substring(0,25)+"…" : label, n.x, n.y+r+10);
    }
  }

  ctx.restore();
  drawMinimap();
}

function drawMinimap() {
  if (nodes.length===0) return;
  const mW=160, mH=100;
  mmCtx.clearRect(0,0,mW,mH);
  mmCtx.fillStyle = "#0a0a0f";
  mmCtx.fillRect(0,0,mW,mH);

  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for (const n of nodes) {
    minX=Math.min(minX,n.x); maxX=Math.max(maxX,n.x);
    minY=Math.min(minY,n.y); maxY=Math.max(maxY,n.y);
  }
  const pad=20;
  const sx = mW/(maxX-minX+pad*2);
  const sy = mH/(maxY-minY+pad*2);
  const s = Math.min(sx,sy);

  for (const n of nodes) {
    const mx = (n.x-minX+pad)*s;
    const my = (n.y-minY+pad)*s;
    mmCtx.beginPath();
    mmCtx.arc(mx,my,1.5,0,Math.PI*2);
    mmCtx.fillStyle = catColors[n.category]||"#666";
    mmCtx.globalAlpha = 0.7;
    mmCtx.fill();
  }
  mmCtx.globalAlpha = 1;

  // Viewport rect
  const vx1 = (cam.x+W/2-W/(2*cam.zoom)-minX+pad)*s;
  const vy1 = (cam.y+H/2-H/(2*cam.zoom)-minY+pad)*s;
  const vw = (W/cam.zoom)*s;
  const vh = (H/cam.zoom)*s;
  mmCtx.strokeStyle = "rgba(139,92,246,0.5)";
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect(vx1,vy1,vw,vh);
}

// Interaction
function screenToWorld(sx,sy) {
  return { x: (sx-W/2)/cam.zoom+cam.x+W/2, y: (sy-H/2)/cam.zoom+cam.y+H/2 };
}
function findNode(mx,my) {
  const p = screenToWorld(mx,my);
  for (let i=nodes.length-1; i>=0; i--) {
    const n=nodes[i];
    const dx=p.x-n.x, dy=p.y-n.y;
    if (dx*dx+dy*dy < (n._r+4)*(n._r+4)) return n;
  }
  return null;
}

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const f = e.deltaY>0 ? 0.9 : 1.1;
  cam.zoom = Math.max(0.03, Math.min(10, cam.zoom*f));
  draw();
});

canvas.addEventListener("mousedown", e => {
  const n = findNode(e.clientX, e.clientY);
  if (n) dragNode=n; else dragging=true;
  lastM = {x:e.clientX, y:e.clientY};
});

canvas.addEventListener("mousemove", e => {
  if (dragNode) {
    const p = screenToWorld(e.clientX,e.clientY);
    dragNode.x=p.x; dragNode.y=p.y;
    draw();
  } else if (dragging) {
    cam.x -= (e.clientX-lastM.x)/cam.zoom;
    cam.y -= (e.clientY-lastM.y)/cam.zoom;
    lastM = {x:e.clientX, y:e.clientY};
    draw();
  } else {
    const n = findNode(e.clientX, e.clientY);
    if (n) {
      canvas.style.cursor = "pointer";
      showTooltip(e, n);
    } else {
      canvas.style.cursor = "default";
      tooltip.style.display = "none";
    }
  }
});

canvas.addEventListener("mouseup", () => { dragging=false; dragNode=null; });

canvas.addEventListener("click", e => {
  const n = findNode(e.clientX, e.clientY);
  if (n) {
    if (pathMode) showPathFinder(n);
    highlightId = highlightId===n.id ? null : n.id;
  } else {
    highlightId = null;
  }
  draw();
});

function showTooltip(e, n) {
  const deps = (outE.get(n.id)||[]);
  const consumers = (inE.get(n.id)||[]);

  tooltip.querySelector(".tt-slug").textContent = n.id;
  tooltip.querySelector(".tt-cluster").textContent = n.cluster + " · " + n.toolkit + " · " + n.category;
  tooltip.querySelector(".tt-desc").textContent = n.description;

  // Deps with priority badges and reasons
  if (deps.length > 0) {
    const grouped = new Map();
    for (const d of deps) {
      const key = d.target;
      if (!grouped.has(key)) grouped.set(key, d);
    }
    let html = "";
    for (const [target, d] of [...grouped.entries()].slice(0, 8)) {
      const short = target.replace(/^(GOOGLESUPER_|GITHUB_)/,"");
      const badge = d.priority===1 ? '<span class="tt-badge tt-primary">PRIMARY</span>'
        : d.priority===2 ? '<span class="tt-badge tt-alternative">ALT</span>'
        : '<span class="tt-badge" style="background:#1e293b;color:#64748b">INDIRECT</span>';
      const upBadge = d.userProvidable ? ' <span class="tt-badge tt-user">USER OK</span>' : '';
      html += badge + upBadge + ' ' + short + ' <span class="tt-reason">via ' + d.param + ' — ' + d.reason + '</span><br>';
    }
    if (grouped.size > 8) html += '<span style="color:#555">+' + (grouped.size-8) + ' more</span>';
    tooltip.querySelector(".tt-deps").innerHTML = html;
  } else {
    tooltip.querySelector(".tt-deps").textContent = "No dependencies (root tool)";
  }

  if (consumers.length > 0) {
    const sources = [...new Set(consumers.map(e=>e.source))];
    tooltip.querySelector(".tt-consumers").textContent =
      sources.slice(0,6).map(s=>s.replace(/^(GOOGLESUPER_|GITHUB_)/,"")).join(", ") +
      (sources.length>6 ? " +" + (sources.length-6) + " more" : "");
  } else {
    tooltip.querySelector(".tt-consumers").textContent = "No consumers (leaf tool)";
  }

  tooltip.style.display = "block";
  tooltip.style.left = Math.min(e.clientX+15, W-500) + "px";
  tooltip.style.top = Math.min(e.clientY+15, H-200) + "px";
}

function showPathFinder(n) {
  const plans = G.executionPlans[n.id];
  const pathTitle = document.getElementById("path-title");
  const pathChains = document.getElementById("path-chains");

  pathTitle.textContent = "Execution Plan for " + n.id.replace(/^(GOOGLESUPER_|GITHUB_)/,"");

  if (!plans || plans.length === 0) {
    // Build simple 1-hop plan
    const deps = (outE.get(n.id)||[]).filter(e => e.priority <= 2);
    if (deps.length === 0) {
      pathChains.innerHTML = '<div class="path-chain" style="color:#888">No precursor tools needed — this tool can be called directly.</div>';
    } else {
      const grouped = new Map();
      for (const d of deps) {
        if (!grouped.has(d.param)) grouped.set(d.param, []);
        grouped.get(d.param).push(d);
      }
      let html = '';
      for (const [param, ds] of grouped) {
        const primary = ds.find(d=>d.priority===1);
        const target = primary ? primary.target : ds[0].target;
        html += '<div class="path-chain">';
        html += '<span class="path-param">Need: ' + param + '</span><br>';
        html += target.replace(/^(GOOGLESUPER_|GITHUB_)/,"");
        html += ' <span class="path-arrow">→</span> ';
        html += n.id.replace(/^(GOOGLESUPER_|GITHUB_)/,"");
        html += '</div>';
      }
      pathChains.innerHTML = html;
    }
  } else {
    // Show multi-hop chains
    let html = '';
    // Deduplicate by final chain shape
    const seen = new Set();
    for (const p of plans) {
      const key = p.chain.join("->");
      if (seen.has(key)) continue;
      seen.add(key);
      html += '<div class="path-chain">';
      html += '<span class="path-param">depth=' + p.depth + '</span> ';
      html += p.chain.map(s => s.replace(/^(GOOGLESUPER_|GITHUB_)/,"")).join(' <span class="path-arrow">→</span> ');
      html += '</div>';
      if (seen.size >= 8) break;
    }
    pathChains.innerHTML = html;
  }

  pathFinder.style.display = "block";
}

window.addEventListener("resize", () => {
  W = window.innerWidth-260; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  canvas.style.width = W+"px";
  draw();
});

document.getElementById("search").addEventListener("input", rebuild);
document.getElementById("toolkit-filter").addEventListener("change", rebuild);
document.getElementById("category-filter").addEventListener("change", rebuild);

rebuild();
</script>
</body>
</html>`;

writeFileSync("./visualization.html", html, "utf8");
console.log("Premium visualization generated: visualization.html (" + (html.length/1024).toFixed(0) + "KB)");
