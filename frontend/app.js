// ── DOM refs ──
const sourceSelect      = document.querySelector("#sourceSelect");
const destinationSelect = document.querySelector("#destinationSelect");
const speedSelect       = document.querySelector("#speedSelect");
const runButton         = document.querySelector("#runButton");
const runMapButton      = document.querySelector("#runMapButton");
const sourceInput       = document.querySelector("#sourceInput");
const destInput         = document.querySelector("#destInput");

const btnGraphView      = document.querySelector("#btnGraphView");
const btnMapView        = document.querySelector("#btnMapView");
const graphViewContainer= document.querySelector("#graphViewContainer");
const mapViewContainer  = document.querySelector("#mapViewContainer");
const demoControls      = document.querySelector("#demoControls");
const mapControls       = document.querySelector("#mapControls");

// Per-algorithm panel targets
const PANELS = [
  { key: "dijkstra", svgId: "svg-dijkstra", statusId: "status-dijkstra", pathId: "path-dijkstra", costId: "cost-dijkstra", exploredId: "explored-dijkstra", timeId: "time-dijkstra" },
  { key: "astar", svgId: "svg-astar", statusId: "status-astar", pathId: "path-astar", costId: "cost-astar", exploredId: "explored-astar", timeId: "time-astar" },
  { key: "bellmanford", svgId: "svg-bellman", statusId: "status-bellman", pathId: "path-bellman", costId: "cost-bellman", exploredId: "explored-bellman", timeId: "time-bellman" },
];

// ── State ──
let graph = { nodes: {}, edges: [] };
let animationControllers = [];
let map = null;
window.mapInstance = null; // Debugging
let mapRouteLayer = null;
let mapMarkers = [];

const SVG_NS = "http://www.w3.org/2000/svg";

// ── Utilities ──
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function edgeKey(a, b) { return [a, b].sort().join("-"); }

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); });
  });
}

// ── Map Initialization ──
function initMap() {
    if (map) return;
    console.log("Initializing map...");
    try {
        // Initialize with standard OSM tiles for better reliability
        map = L.map('map', {
            zoomControl: false,
            center: [12.9716, 77.5946],
            zoom: 12
        });
        
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        window.mapInstance = map;
        
        // Force size recalculation immediately
        map.invalidateSize();
        console.log("Map initialized and size invalidated.");
    } catch (err) {
        console.error("Map initialization failed:", err);
    }
}

// ── View Switching ──
btnGraphView.addEventListener("click", () => {
    btnGraphView.classList.add("active");
    btnMapView.classList.remove("active");
    graphViewContainer.classList.remove("hidden");
    mapViewContainer.classList.add("hidden");
    demoControls.classList.remove("hidden");
    mapControls.classList.add("hidden");
});

btnMapView.addEventListener("click", () => {
    btnMapView.classList.add("active");
    btnGraphView.classList.remove("active");
    mapViewContainer.classList.remove("hidden");
    graphViewContainer.classList.add("hidden");
    mapControls.classList.remove("hidden");
    demoControls.classList.add("hidden");
    
    // Crucial: Leaflet needs to know the size when it becomes visible
    initMap();
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
            console.log("Map size re-invalidated after delay.");
        }, 300);
    }
});

// ── Populate Demo Selects ──
function populateSelects() {
  const nodes = Object.keys(graph.nodes).sort();
  [sourceSelect, destinationSelect].forEach((sel, i) => {
    sel.innerHTML = "";
    nodes.forEach(n => sel.appendChild(new Option(n, n)));
    sel.value = i === 0 ? "A" : "J";
  });
}

function renderInitialDemoGraphs() {
  const source = sourceSelect.value;
  const destination = destinationSelect.value;

  PANELS.forEach(panel => {
    const svgRef = document.querySelector(`#${panel.svgId}`);
    if (svgRef) drawBaseGraph(svgRef, source, destination);
  });
}

// ── SVG Drawing ──
function drawBaseGraph(svgEl_ref, source, destination, pathEdgeSet = new Set(), pathNodeSet = new Set()) {
  svgEl_ref.innerHTML = "";
  if (!graph.edges || !graph.nodes) return;

  graph.edges.forEach(edge => {
    const s = graph.nodes[edge.from];
    const e = graph.nodes[edge.to];
    if (!s || !e) return;
    const isPath = pathEdgeSet.has(edgeKey(edge.from, edge.to));
    svgEl_ref.appendChild(svgEl("line", {
      x1: s.x, y1: s.y, x2: e.x, y2: e.y,
      class: `edge${isPath ? " path-edge" : ""}`,
      "data-edge": edgeKey(edge.from, edge.to),
    }));
  });

  Object.entries(graph.nodes).forEach(([name, pt]) => {
    const classes = ["node"];
    if (name === source) classes.push("source");
    if (name === destination) classes.push("destination");
    if (pathNodeSet.has(name)) classes.push("on-path");
    
    svgEl_ref.appendChild(svgEl("circle", {
      cx: pt.x, cy: pt.y, r: 15,
      class: classes.join(" "),
      "data-node": name,
    }));
    const lbl = svgEl("text", { x: pt.x, y: pt.y, class: "node-label" });
    lbl.textContent = name;
    svgEl_ref.appendChild(lbl);
  });
}

function setNodeState(svgRef, name, state, source, destination) {
  const el = svgRef.querySelector(`[data-node="${name}"]`);
  if (!el) return;
  el.classList.remove("frontier", "visited", "on-path");
  if (state !== "none" && name !== source && name !== destination) el.classList.add(state);
  if (state === "on-path") el.classList.add("on-path");
}

async function animatePanel(panel, result, stepDelayMs, signal) {
  const svgRef = document.querySelector(`#${panel.svgId}`);
  const statusEl = document.querySelector(`#${panel.statusId}`);
  const source = result.source;
  const destination = result.destination;
  const steps = result.steps || [];

  drawBaseGraph(svgRef, source, destination);
  statusEl.textContent = "Running...";
  statusEl.className = "animation-status running";

  const visitedNodes = new Set();
  const frontierNodes = new Set();

  try {
    for (const step of steps) {
      const settledList = Array.isArray(step.settled) ? step.settled : [step.settled];
      const frontierList = Array.isArray(step.frontier) ? step.frontier : (step.frontier ? [step.frontier] : []);

      frontierNodes.forEach(n => { if (!visitedNodes.has(n)) setNodeState(svgRef, n, "none", source, destination); });
      frontierNodes.clear();

      settledList.forEach(n => { visitedNodes.add(n); setNodeState(svgRef, n, "visited", source, destination); });
      frontierList.forEach(n => { if (!visitedNodes.has(n)) { frontierNodes.add(n); setNodeState(svgRef, n, "frontier", source, destination); } });

      await delay(stepDelayMs, signal);
    }

    if (result.path?.length) {
      result.path.forEach(n => setNodeState(svgRef, n, "on-path", source, destination));
      const pathSet = new Set();
      for (let i = 0; i < result.path.length - 1; i++) pathSet.add(edgeKey(result.path[i], result.path[i + 1]));
      svgRef.querySelectorAll(".edge").forEach(el => { if (pathSet.has(el.getAttribute("data-edge"))) el.classList.add("path-edge"); });
    }

    document.querySelector(`#${panel.pathId}`).textContent = result.path?.length ? result.path.join("→") : "None";
    document.querySelector(`#${panel.costId}`).textContent = result.totalCost || "∞";
    document.querySelector(`#${panel.exploredId}`).textContent = result.nodesExplored;
    document.querySelector(`#${panel.timeId}`).textContent = `${result.executionTimeMs}ms`;
    
    statusEl.textContent = "Done";
    statusEl.className = "animation-status done";
  } catch (err) {
    if (err.name === "AbortError") statusEl.textContent = "Stopped";
  }
}

// ── Run Demo Logic ──
async function runDemo() {
  animationControllers.forEach(c => c.abort());
  animationControllers = [];
  runButton.disabled = true;

  const source = sourceSelect.value;
  const destination = destinationSelect.value;
  const stepDelayMs = parseInt(speedSelect.value, 10);

  try {
    const res = await fetch(`/animate?source=${source}&destination=${destination}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const promises = PANELS.map((panel, i) => {
      const controller = new AbortController();
      animationControllers.push(controller);
      return animatePanel(panel, data.results[i], stepDelayMs, controller.signal);
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(err);
  } finally {
    runButton.disabled = false;
  }
}

// ── Real World Map Logic ──
async function runMap() {
    runMapButton.disabled = true;
    runMapButton.textContent = "Calculating...";
    const resultsContainer = document.querySelector("#mapComparisonResults");
    resultsContainer.innerHTML = '<p class="muted">Running algorithms on road network...</p>';

    // Clear previous
    if (mapRouteLayer) map.removeLayer(mapRouteLayer);
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    const src = sourceInput.value;
    const dst = destInput.value;

    try {
        const res = await fetch(`/map-route?source=${encodeURIComponent(src)}&destination=${encodeURIComponent(dst)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch route");

        const results = data.results;
        const nodes = data.nodes;

        // Draw results on sidebar
        resultsContainer.innerHTML = results.map(r => `
            <div class="algo-result-item">
                <div class="result-header">
                    <span class="result-name">${r.algorithm}</span>
                    <span class="result-time">${r.executionTimeMs.toFixed(2)} ms</span>
                </div>
                <div class="result-stats">
                    Cost: ${r.totalCost ? (r.totalCost / 1000).toFixed(2) : "∞"} km | Explored: ${r.nodesExplored}
                </div>
            </div>
        `).join('');

        // Draw path on map
        const bestPath = results.find(r => r.algorithm === "A* Search") || results[0];
        if (bestPath && bestPath.path && bestPath.path.length > 0) {
            const coords = bestPath.path.map(nodeId => {
                const n = nodes[nodeId.toString()];
                return n ? [n.lat, n.lng] : null;
            }).filter(c => c !== null);

            if (coords.length > 0) {
                mapRouteLayer = L.polyline(coords, { color: '#f97316', weight: 6, opacity: 0.9 }).addTo(map);
                
                const start = coords[0];
                const end = coords[coords.length - 1];
                
                mapMarkers.push(L.circleMarker(start, { radius: 8, color: '#22c55e', fillOpacity: 1 }).addTo(map));
                mapMarkers.push(L.circleMarker(end, { radius: 8, color: '#ef4444', fillOpacity: 1 }).addTo(map));
                
                map.fitBounds(mapRouteLayer.getBounds(), { padding: [50, 50] });
            }
        } else {
            resultsContainer.innerHTML += '<p class="error">No path found between these locations.</p>';
        }

    } catch (err) {
        resultsContainer.innerHTML = `<p class="error" style="color:#ef4444">Error: ${err.message}</p>`;
    } finally {
        runMapButton.disabled = false;
        runMapButton.textContent = "▶ Calculate Road Route";
    }
}

runButton.addEventListener("click", runDemo);
runMapButton.addEventListener("click", runMap);
sourceSelect.addEventListener("change", renderInitialDemoGraphs);
destinationSelect.addEventListener("change", renderInitialDemoGraphs);

// ── Init ──
async function init() {
  try {
    const res = await fetch("/graph");
    if (res.ok) {
        graph = await res.json();
        populateSelects();
        renderInitialDemoGraphs();
    }
  } catch (err) { console.error("Initial load failed:", err); }
}

init();
