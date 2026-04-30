from math import hypot


NODES = {
    "A": {"x": 80, "y": 90},
    "B": {"x": 210, "y": 60},
    "C": {"x": 350, "y": 115},
    "D": {"x": 500, "y": 80},
    "E": {"x": 135, "y": 230},
    "F": {"x": 280, "y": 250},
    "G": {"x": 430, "y": 235},
    "H": {"x": 570, "y": 205},
    "I": {"x": 225, "y": 390},
    "J": {"x": 405, "y": 385},
}


EDGE_PAIRS = [
    ("A", "B"),
    ("A", "E"),
    ("B", "C"),
    ("B", "E"),
    ("B", "F"),
    ("C", "D"),
    ("C", "F"),
    ("C", "G"),
    ("D", "H"),
    ("E", "F"),
    ("E", "I"),
    ("F", "G"),
    ("F", "I"),
    ("F", "J"),
    ("G", "H"),
    ("G", "J"),
    ("H", "J"),
    ("I", "J"),
]


def euclidean_distance(first, second):
    a = NODES[first]
    b = NODES[second]
    return hypot(a["x"] - b["x"], a["y"] - b["y"])


def build_graph():
    graph = {node: [] for node in NODES}
    edges = []

    for start, end in EDGE_PAIRS:
        weight = euclidean_distance(start, end)
        graph[start].append({"node": end, "weight": weight})
        graph[end].append({"node": start, "weight": weight})
        edges.append({"from": start, "to": end, "weight": weight})

    return graph, edges


GRAPH, EDGES = build_graph()

