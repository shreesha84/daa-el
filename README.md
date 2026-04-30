# Delivery Route Optimization System

This project contains a Flask backend and a browser UI for comparing Dijkstra, A* Search, and Bellman-Ford on the same coordinate-based delivery graph.

## Features

- 10 predefined delivery nodes with 2D coordinates.
- Undirected weighted graph using Euclidean edge distances.
- API endpoints for each algorithm and a combined comparison endpoint.
- Browser visualization with source and destination selectors.
- Highlighted shortest path, total cost, execution time, and nodes explored.

## Project Structure

```text
backend/
  app.py
  algorithms.py
  graph_data.py
  requirements.txt
frontend/
  index.html
  styles.css
  app.js
README.md
```

## Run Locally

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open the app at:

```text
http://127.0.0.1:5000
```

## API Examples

```text
GET /graph
GET /run/dijkstra?source=A&destination=J
GET /run/astar?source=A&destination=J
GET /run/bellmanford?source=A&destination=J
GET /compare?source=A&destination=J
```

Each algorithm endpoint returns:

```json
{
  "algorithm": "Dijkstra",
  "source": "A",
  "destination": "J",
  "path": ["A", "E", "I", "J"],
  "totalCost": 491.95,
  "executionTimeMs": 0.0221,
  "nodesExplored": 8
}
```

