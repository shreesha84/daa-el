const svg = document.querySelector("#graphSvg");
const sourceSelect = document.querySelector("#sourceSelect");
const destinationSelect = document.querySelector("#destinationSelect");
const algorithmSelect = document.querySelector("#algorithmSelect");
const runButton = document.querySelector("#runButton");
const compareButton = document.querySelector("#compareButton");
const comparisonCards = document.querySelector("#comparisonCards");

const resultTitle = document.querySelector("#resultTitle");
const pathValue = document.querySelector("#pathValue");
const costValue = document.querySelector("#costValue");
const timeValue = document.querySelector("#timeValue");
const exploredValue = document.querySelector("#exploredValue");

let graph = { nodes: {}, edges: [] };
let activePath = [];

const algorithmEndpoints = {
  dijkstra: "/run/dijkstra",
  astar: "/run/astar",
  bellmanford: "/run/bellmanford",
};

function edgeKey(a, b) {
  return [a, b].sort().join("-");
}

function activeEdgeSet() {
  const keys = new Set();
  for (let index = 0; index < activePath.length - 1; index += 1) {
    keys.add(edgeKey(activePath[index], activePath[index + 1]));
  }
  return keys;
}

function drawGraph() {
  const activeEdges = activeEdgeSet();
  const source = sourceSelect.value;
  const destination = destinationSelect.value;
  const activeNodes = new Set(activePath);

  svg.innerHTML = "";

  graph.edges.forEach((edge) => {
    const start = graph.nodes[edge.from];
    const end = graph.nodes[edge.to];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
    line.setAttribute("class", `edge ${activeEdges.has(edgeKey(edge.from, edge.to)) ? "active" : ""}`);
    svg.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", (start.x + end.x) / 2);
    label.setAttribute("y", (start.y + end.y) / 2 - 6);
    label.setAttribute("class", "edge-label");
    label.textContent = edge.weight.toFixed(0);
    svg.appendChild(label);
  });

  Object.entries(graph.nodes).forEach(([name, point]) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 18);
    circle.setAttribute(
      "class",
      [
        "node",
        name === source ? "source" : "",
        name === destination ? "destination" : "",
        activeNodes.has(name) ? "active" : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    svg.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", point.x);
    label.setAttribute("y", point.y + 1);
    label.setAttribute("class", "node-label");
    label.textContent = name;
    svg.appendChild(label);
  });
}

function setResult(result) {
  activePath = result.path || [];
  resultTitle.textContent = result.algorithm;
  pathValue.textContent = result.path?.length ? result.path.join(" -> ") : "No path";
  costValue.textContent = result.totalCost ?? "Unreachable";
  timeValue.textContent = `${result.executionTimeMs} ms`;
  exploredValue.textContent = result.nodesExplored;
  drawGraph();
}

function showError(message) {
  resultTitle.innerHTML = `<span class="error">${message}</span>`;
  pathValue.textContent = "-";
  costValue.textContent = "-";
  timeValue.textContent = "-";
  exploredValue.textContent = "-";
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function selectedQuery() {
  return `source=${encodeURIComponent(sourceSelect.value)}&destination=${encodeURIComponent(destinationSelect.value)}`;
}

async function runSelected() {
  try {
    const selected = algorithmSelect.value;
    if (selected === "compare") {
      const comparison = await getJson(`/compare?${selectedQuery()}`);
      renderComparison(comparison.results);
      setResult(comparison.results[0]);
      return;
    }

    const result = await getJson(`${algorithmEndpoints[selected]}?${selectedQuery()}`);
    setResult(result);
  } catch (error) {
    showError(error.message);
  }
}

function renderComparison(results) {
  comparisonCards.innerHTML = "";
  results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "comparison-card";
    card.innerHTML = `
      <h3>${result.algorithm}</h3>
      <div><span>Path</span><strong>${result.path.join(" -> ")}</strong></div>
      <div class="comparison-row">
        <div><span>Cost</span><strong>${result.totalCost}</strong></div>
        <div><span>Time</span><strong>${result.executionTimeMs} ms</strong></div>
        <div><span>Explored</span><strong>${result.nodesExplored}</strong></div>
      </div>
    `;
    card.addEventListener("click", () => setResult(result));
    comparisonCards.appendChild(card);
  });
}

async function refreshComparison() {
  try {
    const comparison = await getJson(`/compare?${selectedQuery()}`);
    renderComparison(comparison.results);
  } catch (error) {
    comparisonCards.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

function populateSelects() {
  Object.keys(graph.nodes).forEach((node) => {
    const sourceOption = new Option(node, node);
    const destinationOption = new Option(node, node);
    sourceSelect.appendChild(sourceOption);
    destinationSelect.appendChild(destinationOption);
  });
  sourceSelect.value = "A";
  destinationSelect.value = "J";
}

async function initialize() {
  graph = await getJson("/graph");
  populateSelects();
  drawGraph();
  await runSelected();
}

runButton.addEventListener("click", runSelected);
compareButton.addEventListener("click", refreshComparison);
sourceSelect.addEventListener("change", drawGraph);
destinationSelect.addEventListener("change", drawGraph);

initialize().catch((error) => showError(error.message));

