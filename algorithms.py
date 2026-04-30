from heapq import heappop, heappush
from math import inf, hypot
from time import perf_counter

from graph_data import GRAPH, NODES


def heuristic(node, destination):
    current = NODES[node]
    target = NODES[destination]
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


def format_result(algorithm, source, destination, cost, previous, elapsed_ms, explored):
    path = reconstruct_path(previous, source, destination)
    return {
        "algorithm": algorithm,
        "source": source,
        "destination": destination,
        "path": path,
        "totalCost": round(cost, 2) if cost != inf else None,
        "executionTimeMs": round(elapsed_ms, 4),
        "nodesExplored": explored,
    }


def validate_nodes(source, destination):
    if source not in GRAPH:
        raise ValueError(f"Unknown source node: {source}")
    if destination not in GRAPH:
        raise ValueError(f"Unknown destination node: {destination}")


def dijkstra(source, destination):
    validate_nodes(source, destination)
    start_time = perf_counter()

    distances = {node: inf for node in GRAPH}
    previous = {source: None}
    visited = set()
    queue = [(0, source)]
    distances[source] = 0

    while queue:
        current_distance, current = heappop(queue)
        if current in visited:
            continue

        visited.add(current)
        if current == destination:
            break

        for edge in GRAPH[current]:
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
    )


def astar(source, destination):
    validate_nodes(source, destination)
    start_time = perf_counter()

    g_score = {node: inf for node in GRAPH}
    previous = {source: None}
    visited = set()
    queue = [(heuristic(source, destination), 0, source)]
    g_score[source] = 0

    while queue:
        _, current_cost, current = heappop(queue)
        if current in visited:
            continue

        visited.add(current)
        if current == destination:
            break

        for edge in GRAPH[current]:
            neighbor = edge["node"]
            tentative_cost = current_cost + edge["weight"]
            if tentative_cost < g_score[neighbor]:
                g_score[neighbor] = tentative_cost
                previous[neighbor] = current
                priority = tentative_cost + heuristic(neighbor, destination)
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
    )


def bellman_ford(source, destination):
    validate_nodes(source, destination)
    start_time = perf_counter()

    distances = {node: inf for node in GRAPH}
    previous = {source: None}
    distances[source] = 0
    explored_nodes = set()

    directed_edges = []
    for start, neighbors in GRAPH.items():
        for edge in neighbors:
            directed_edges.append((start, edge["node"], edge["weight"]))

    for _ in range(len(GRAPH) - 1):
        changed = False
        for start, end, weight in directed_edges:
            if distances[start] == inf:
                continue

            explored_nodes.add(start)
            if distances[start] + weight < distances[end]:
                distances[end] = distances[start] + weight
                previous[end] = start
                changed = True
        if not changed:
            break

    for start, end, weight in directed_edges:
        if distances[start] != inf and distances[start] + weight < distances[end]:
            raise ValueError("Graph contains a negative-weight cycle")

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
    )


ALGORITHMS = {
    "dijkstra": dijkstra,
    "astar": astar,
    "bellmanford": bellman_ford,
}
