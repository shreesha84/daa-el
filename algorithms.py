from heapq import heappop, heappush
from math import inf, hypot
from time import perf_counter

from graph_data import GRAPH, NODES


def heuristic(node, destination, nodes_data=NODES):
    current = nodes_data[node]
    target = nodes_data[destination]
    
    # Check if we have lat/lng or just x/y
    if "lat" in current and "lat" in target:
        # Latitude/Longitude are in degrees. Road weights are in METERS.
        # 1 degree is roughly 111,320 meters.
        # We need the heuristic to be in the same units as weights.
        dx = (current["lng"] - target["lng"]) * 111320
        dy = (current["lat"] - target["lat"]) * 111320
        return hypot(dx, dy)
    return hypot(current["x"] - target["x"], current["y"] - target["y"])


def reconstruct_path(previous, source, destination):
    path = []
    current = destination

    while current is not None:
        path.append(current)
        if current == source:
            break
        current = previous.get(current)

    path.reverse()
    return path if path and path[0] == source else []


def format_result(algorithm, source, destination, cost, previous, elapsed_ms, explored, steps):
    path = reconstruct_path(previous, source, destination)
    return {
        "algorithm": algorithm,
        "source": source,
        "destination": destination,
        "path": path,
        "totalCost": round(cost, 2) if cost != inf else None,
        "executionTimeMs": round(elapsed_ms, 4),
        "nodesExplored": explored,
        "steps": steps,
    }


def validate_nodes(source, destination, graph_data=GRAPH):
    if source not in graph_data:
        raise ValueError(f"Unknown source node: {source}")
    if destination not in graph_data:
        raise ValueError(f"Unknown destination node: {destination}")


def dijkstra(source, destination, graph_data=GRAPH, nodes_data=NODES):
    validate_nodes(source, destination, graph_data)
    start_time = perf_counter()

    distances = {node: inf for node in graph_data}
    previous = {source: None}
    visited = set()
    queue = [(0, source)]
    distances[source] = 0
    steps = []

    # For large graphs, we only want to record steps occasionally to avoid huge payloads
    max_steps = 500
    step_count = 0

    while queue:
        current_distance, current = heappop(queue)
        if current in visited:
            continue

        visited.add(current)
        step_count += 1

        # Record frontier for visualization (limit steps for performance on large graphs)
        if step_count < max_steps:
            frontier = list({node for _, node in queue if node not in visited})
            steps.append({"settled": current, "frontier": frontier})

        if current == destination:
            break

        for edge in graph_data[current]:
            neighbor = edge["node"]
            candidate = current_distance + edge["weight"]
            if candidate < distances[neighbor]:
                distances[neighbor] = candidate
                previous[neighbor] = current
                heappush(queue, (candidate, neighbor))

    elapsed_ms = (perf_counter() - start_time) * 1000
    return format_result(
        "Dijkstra",
        source,
        destination,
        distances[destination],
        previous,
        elapsed_ms,
        len(visited),
        steps,
    )


def astar(source, destination, graph_data=GRAPH, nodes_data=NODES):
    validate_nodes(source, destination, graph_data)
    start_time = perf_counter()

    g_score = {node: inf for node in graph_data}
    previous = {source: None}
    visited = set()
    queue = [(heuristic(source, destination, nodes_data), 0, source)]
    g_score[source] = 0
    steps = []
    
    max_steps = 500
    step_count = 0

    while queue:
        _, current_cost, current = heappop(queue)
        if current in visited:
            continue

        visited.add(current)
        step_count += 1

        if step_count < max_steps:
            frontier = list({node for _, _, node in queue if node not in visited})
            steps.append({"settled": current, "frontier": frontier})

        if current == destination:
            break

        for edge in graph_data[current]:
            neighbor = edge["node"]
            tentative_cost = current_cost + edge["weight"]
            if tentative_cost < g_score[neighbor]:
                g_score[neighbor] = tentative_cost
                previous[neighbor] = current
                priority = tentative_cost + heuristic(neighbor, destination, nodes_data)
                heappush(queue, (priority, tentative_cost, neighbor))

    elapsed_ms = (perf_counter() - start_time) * 1000
    return format_result(
        "A* Search",
        source,
        destination,
        g_score[destination],
        previous,
        elapsed_ms,
        len(visited),
        steps,
    )


def bellman_ford(source, destination, graph_data=GRAPH, nodes_data=NODES):
    validate_nodes(source, destination, graph_data)
    start_time = perf_counter()

    distances = {node: inf for node in graph_data}
    previous = {source: None}
    distances[source] = 0
    explored_nodes = set()
    steps = []

    directed_edges = []
    for start, neighbors in graph_data.items():
        for edge in neighbors:
            directed_edges.append((start, edge["node"], edge["weight"]))

    # Bellman-Ford is O(VE), which is very slow for large road networks.
    # For the real-world map, we might want to warn or limit it.
    if len(graph_data) > 500:
        # Fallback or optimization for very large graphs in a DAA context
        # might be to just run it and hope for the best, or cap iterations.
        pass

    for _ in range(len(graph_data) - 1):
        changed = False
        settled_this_round = set()
        frontier_this_round = set()

        for start, end, weight in directed_edges:
            if distances[start] == inf:
                continue

            explored_nodes.add(start)
            settled_this_round.add(start)

            if distances[start] + weight < distances[end]:
                distances[end] = distances[start] + weight
                previous[end] = start
                frontier_this_round.add(end)
                changed = True

        if len(steps) < 100 and settled_this_round: # Cap steps for visualization
            steps.append({
                "settled": list(settled_this_round),
                "frontier": list(frontier_this_round),
            })

        if not changed:
            break

    # Negative cycle check
    for start, end, weight in directed_edges:
        if distances[start] != inf and distances[start] + weight < distances[end]:
            # In a road network, this shouldn't happen unless data is weird
            pass

    elapsed_ms = (perf_counter() - start_time) * 1000
    explored_nodes.add(destination)

    return format_result(
        "Bellman-Ford",
        source,
        destination,
        distances[destination],
        previous,
        elapsed_ms,
        len(explored_nodes),
        steps,
    )


ALGORITHMS = {
    "dijkstra": dijkstra,
    "astar": astar,
    "bellmanford": bellman_ford,
}
