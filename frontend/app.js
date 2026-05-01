// ── DOM refs ──
const sourceSelect      = document.querySelector("#sourceSelect");
const destinationSelect = document.querySelector("#destinationSelect");
const speedSelect       = document.querySelector("#speedSelect");
const runButton         = document.querySelector("#runButton");
const replayButton      = document.querySelector("#replayButton");

// Per-algorithm panel targets
const PANELS = [
  {
    key:      "dijkstra",
    svgId:    "svg-dijkstra",
    statusId: "status-dijkstra",
    pathId:   "path-dijkstra",
    costId:   "cost-dijkstra",
    exploredId:"explored-dijkstra",
    timeId:   "time-dijkstra",
  },
  {
    key:      "astar",
    svgId:    "svg-astar",
    statusId: "status-astar",
    pathId:   "path-astar",
    costId:   "cost-astar",
    exploredId:"explored-astar",
    timeId:   "time-astar",
  },
  {
    key:      "bellmanford",
    svgId:    "svg-bellman",
    statusId: "status-bellman",
    pathId:   "path-bellman",
    costId:   "cost-bellman",
    exploredId:"explored-bellman",
    timeId:   "time-bellman",
  },
];

// ── State ──
let graph = { nodes: {}, edges: [] };
let lastResults = null;   // stored so Replay can re-use without re-fetching
let animationControllers = [];  // AbortControllers, one per panel

// ── SVG namespace helper ──
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ── Utilities ──
function edgeKey(a, b) { return [a, b].sort().join("-"); }

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); });
  });
}

// ── Populate source / destination dropdowns ──
function populateSelects() {
  const nodes = Object.keys(graph.nodes).sort();
  [sourceSelect, destinationSelect].forEach((sel, i) => {
    sel.innerHTML = "";
    nodes.forEach(n => sel.appendChild(new Option(n, n)));
    sel.value = i === 0 ? "A" : "J";
  });
}

// ── Draw the static base graph into a given SVG ──
function drawBaseGraph(svgEl_ref, source, destination, pathEdgeSet = new Set(), pathNodeSet = new Set()) {
  svgEl_ref.innerHTML = "";

  // Edges
  graph.edges.forEach(edge => {
    const s = graph.nodes[edge.from];
    const e = graph.nodes[edge.to];
    const isPath = pathEdgeSet.has(edgeKey(edge.from, edge.to));

    const line = svgEl("line", {
      x1: s.x, y1: s.y,
      x2: e.x, y2: e.y,
      class: `edge${isPath ? " path-edge" : ""}`,
      "data-edge": edgeKey(edge.from, edge.to),
    });
    svgEl_ref.appendChild(line);

    const lbl = svgEl("text", {
      x: (s.x + e.x) / 2,
      y: (s.y + e.y) / 2 - 8,
      class: "edge-label",
    });
    lbl.textContent = edge.weight.toFixed(0);
    svgEl_ref.appendChild(lbl);
  });

  // Nodes
  Object.entries(graph.nodes).forEach(([name, pt]) => {
    const classes = ["node"];
    if (name === source)      classes.push("source");
    if (name === destination) classes.push("destination");
    if (pathNodeSet.has(name)) classes.push("on-path");

    const circle = svgEl("circle", {
      cx: pt.x, cy: pt.y, r: 18,
      class: classes.join(" "),
      "data-node": name,
    });
    svgEl_ref.appendChild(circle);

    const lbl = svgEl("text", {
      x: pt.x, y: pt.y,
      class: "node-label",
    });
    lbl.textContent = name;
    svgEl_ref.appendChild(lbl);
  });
}

// ── Get a node circle element inside a specific SVG by node name ──
function getNodeEl(svgRef, name) {
  return svgRef.querySelector(`[data-node="${name}"]`);
}

// ── Apply a visual state class to a node circle ──
function setNodeState(svgRef, name, state, source, destination) {
  const el = getNodeEl(svgRef, name);
  if (!el) return;

  // Remove mutable state classes
  el.classList.remove("frontier", "visited", "on-path");

  // Source / destination classes are sticky — don't remove them
  if (state === "frontier") {
    if (name !== source && name !== destination) el.classList.add("frontier");
  } else if (state === "visited") {
    if (name !== source && name !== destination) el.classList.add("visited");
  } else if (state === "on-path") {
    el.classList.add("on-path");
  }
}

// ── Highlight final path edges ──
function highlightPathEdges(svgRef, path) {
  const pathSet = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    pathSet.add(edgeKey(path[i], path[i + 1]));
  }
  svgRef.querySelectorAll(".edge").forEach(el => {
    if (pathSet.has(el.getAttribute("data-edge"))) {
      el.classList.add("path-edge");
    }
  });
}

// ── Set status text with class ──
function setStatus(statusEl, text, cls = "") {
  statusEl.textContent = text;
  statusEl.className = "animation-status " + cls;
}

// ── Fill in stats panel ──
function fillStats(panel, result) {
  document.querySelector(`#${panel.pathId}`).textContent =
    result.path?.length ? result.path.join(" → ") : "No path";
  document.querySelector(`#${panel.costId}`).textContent =
    result.totalCost != null ? result.totalCost : "∞";
  document.querySelector(`#${panel.exploredId}`).textContent = result.nodesExplored;
  document.querySelector(`#${panel.timeId}`).textContent = `${result.executionTimeMs} ms`;
}

// ── Animate a single algorithm panel ──
async function animatePanel(panel, result, stepDelayMs, signal) {
  const svgRef = document.querySelector(`#${panel.svgId}`);
  const statusEl = document.querySelector(`#${panel.statusId}`);
  const source = result.source;
  const destination = result.destination;
  const steps = result.steps || [];

  // Draw clean base graph
  drawBaseGraph(svgRef, source, destination);
  setStatus(statusEl, "Exploring…", "running");

  // Track which nodes have been visited so we don't flash-unset them
  const visitedNodes = new Set();
  const frontierNodes = new Set();

  try {
    for (const step of steps) {
      // Support both Dijkstra/A* (single settled string) and Bellman-Ford (array)
      const settledList = Array.isArray(step.settled) ? step.settled : [step.settled];
      const frontierList = Array.isArray(step.frontier) ? step.frontier : (step.frontier ? [step.frontier] : []);

      // Clear previous frontier pulse (only nodes not yet visited)
      frontierNodes.forEach(n => {
        if (!visitedNodes.has(n)) {
          setNodeState(svgRef, n, "none", source, destination);
        }
      });
      frontierNodes.clear();

      // Mark settled nodes
      settledList.forEach(n => {
        visitedNodes.add(n);
        setNodeState(svgRef, n, "visited", source, destination);
      });

      // Mark frontier nodes (skip if already visited)
      frontierList.forEach(n => {
        if (!visitedNodes.has(n)) {
          frontierNodes.add(n);
          setNodeState(svgRef, n, "frontier", source, destination);
        }
      });

      await delay(stepDelayMs, signal);
    }

    // Animation done — highlight optimal path
    if (result.path?.length) {
      const pathSet = new Set(result.path);
      result.path.forEach(n => setNodeState(svgRef, n, "on-path", source, destination));
      // Re-apply source/destination on top
      setNodeState(svgRef, source, "on-path", source, destination);
      setNodeState(svgRef, destination, "on-path", source, destination);
      highlightPathEdges(svgRef, result.path);
    }

    fillStats(panel, result);
    setStatus(statusEl, "Done ✓", "done");

  } catch (err) {
    if (err.name !== "AbortError") throw err;
    // Aborted — reset status but don't crash
    setStatus(statusEl, "Stopped", "");
  }
}

// ── Cancel all running animations ──
function cancelAnimations() {
  animationControllers.forEach(c => c.abort());
  animationControllers = [];
}

// ── Clear all panels to idle state ──
function resetPanels(source, destination) {
  PANELS.forEach(panel => {
    const svgRef = document.querySelector(`#${panel.svgId}`);
    drawBaseGraph(svgRef, source, destination);
    const statusEl = document.querySelector(`#${panel.statusId}`);
    setStatus(statusEl, "Waiting…", "");
    ["path", "cost", "explored", "time"].forEach(key => {
      const el = document.querySelector(`#${panel[key + "Id"]}`);
      if (el) el.textContent = "—";
    });
  });
}

// ── Start animations from stored results ──
function startAnimations(results) {
  cancelAnimations();
  const stepDelayMs = parseInt(speedSelect.value, 10);
  const source = results[0]?.source || sourceSelect.value;
  const destination = results[0]?.destination || destinationSelect.value;

  resetPanels(source, destination);

  const allDone = PANELS.map((panel, i) => {
    const controller = new AbortController();
    animationControllers.push(controller);
    return animatePanel(panel, results[i], stepDelayMs, controller.signal);
  });

  Promise.allSettled(allDone).then(() => {
    runButton.disabled = false;
    replayButton.disabled = false;
  });
}

// ── Fetch and kick off ──
async function run() {
  cancelAnimations();
  runButton.disabled = true;
  replayButton.disabled = true;

  const source = sourceSelect.value;
  const destination = destinationSelect.value;

  // Show "loading" state on all panels
  PANELS.forEach(panel => {
    const statusEl = document.querySelector(`#${panel.statusId}`);
    setStatus(statusEl, "Loading…", "running");
  });

  try {
    const response = await fetch(
      `/animate?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");

    lastResults = data.results;
    startAnimations(lastResults);

  } catch (err) {
    runButton.disabled = false;
    PANELS.forEach(panel => {
      const statusEl = document.querySelector(`#${panel.statusId}`);
      setStatus(statusEl, `Error: ${err.message}`, "error");
    });
  }
}

// ── Replay ──
function replay() {
  if (!lastResults) return;
  replayButton.disabled = true;
  runButton.disabled = true;
  startAnimations(lastResults);
}

// ── Initialize ──
async function initialize() {
  try {
    const response = await fetch("/graph");
    graph = await response.json();
    populateSelects();
    resetPanels(sourceSelect.value, destinationSelect.value);
    // Auto-run on load
    await run();
  } catch (err) {
    PANELS.forEach(panel => {
      const statusEl = document.querySelector(`#${panel.statusId}`);
      setStatus(statusEl, `Failed to load: ${err.message}`, "error");
    });
  }
}

runButton.addEventListener("click", run);
replayButton.addEventListener("click", replay);
sourceSelect.addEventListener("change", () => resetPanels(sourceSelect.value, destinationSelect.value));
destinationSelect.addEventListener("change", () => resetPanels(sourceSelect.value, destinationSelect.value));

initialize();
