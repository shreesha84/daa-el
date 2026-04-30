from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from algorithms import ALGORITHMS, astar, bellman_ford, dijkstra
from graph_data import EDGES, NODES


app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)


def get_route_nodes():
    source = request.args.get("source", "A").upper()
    destination = request.args.get("destination", "J").upper()
    return source, destination


def run_algorithm(key):
    source, destination = get_route_nodes()
    try:
        return jsonify(ALGORITHMS[key](source, destination))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/graph")
def graph():
    return jsonify({"nodes": NODES, "edges": EDGES})


@app.get("/run/dijkstra")
def run_dijkstra():
    return run_algorithm("dijkstra")


@app.get("/run/astar")
def run_astar():
    return run_algorithm("astar")


@app.get("/run/bellmanford")
def run_bellmanford():
    return run_algorithm("bellmanford")


@app.get("/compare")
def compare():
    source, destination = get_route_nodes()
    try:
        results = [
            dijkstra(source, destination),
            astar(source, destination),
            bellman_ford(source, destination),
        ]
        return jsonify({"source": source, "destination": destination, "results": results})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(debug=True)

