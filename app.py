from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from algorithms import ALGORITHMS, astar, bellman_ford, dijkstra
from graph_data import EDGES, NODES
import map_handler

app = Flask(__name__, static_folder="./frontend", static_url_path="")
CORS(app)

# Cache for the Bangalore map graph to avoid re-downloading
BANGALORE_GRAPH = None

def get_bng_graph():
    global BANGALORE_GRAPH
    if BANGALORE_GRAPH is None:
        BANGALORE_GRAPH = map_handler.get_bangalore_graph()
    return BANGALORE_GRAPH

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


@app.get("/animate")
def animate():
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

@app.get("/map-route")
def map_route():
    source_addr = request.args.get("source", "Indiranagar, Bangalore")
    dest_addr = request.args.get("destination", "Sarjapur, Bangalore")
    
    try:
        G = get_bng_graph()
        (s_node, d_node), error = map_handler.get_route_data(G, source_addr, dest_addr)
        
        if error:
            return jsonify({"error": error}), 400
            
        g_data, n_data = map_handler.convert_nx_to_custom_graph(G)
        
        # Run comparison
        results = [
            dijkstra(s_node, d_node, g_data, n_data),
            astar(s_node, d_node, g_data, n_data),
            bellman_ford(s_node, d_node, g_data, n_data),
        ]
        
        return jsonify({
            "source": source_addr,
            "destination": dest_addr,
            "results": results,
            "nodes": n_data
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
    print("Starting Delivery Route Optimizer Server...")
    app.run(debug=True)
