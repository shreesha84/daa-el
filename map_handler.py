import osmnx as ox
import networkx as nx
from geopy.geocoders import Nominatim
import os

# Cache directory for the map data
CACHE_DIR = "map_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

geolocator = Nominatim(user_agent="daa_path_comparison")

def get_bangalore_graph():
    """
    Downloads and caches the street network of Bangalore.
    We'll use a smaller area for performance if needed, or just download Bangalore.
    """
    graph_path = os.path.join(CACHE_DIR, "bangalore_drive.graphml")
    
    if os.path.exists(graph_path):
        G = ox.load_graphml(graph_path)
    else:
        # Bangalore is big, let's try to get a bounding box or a city-wide graph
        # For this demo, we'll download a specific area or just "Bangalore, India"
        print("Downloading Bangalore map data... this might take a minute.")
        G = ox.graph_from_place("Bangalore, India", network_type="drive")
        ox.save_graphml(G, graph_path)
    
    return G

def geocode_address(address):
    """Converts address string to (lat, lng)"""
    location = geolocator.geocode(address)
    if location:
        return (location.latitude, location.longitude)
    return None

def get_route_data(G, source_addr, dest_addr):
    """
    Finds nodes in graph G closest to the addresses and returns graph info.
    """
    source_coords = geocode_address(source_addr)
    dest_coords = geocode_address(dest_addr)
    
    if not source_coords or not dest_coords:
        return None, "Address not found"
    
    # Find nearest nodes in the graph
    source_node = ox.nearest_nodes(G, source_coords[1], source_coords[0])
    dest_node = ox.nearest_nodes(G, dest_coords[1], dest_coords[0])
    
    return (source_node, dest_node), None

def convert_nx_to_custom_graph(G):
    """
    Converts a NetworkX graph (from OSMnx) to the format expected by our algorithms.
    Our algorithms expect:
    GRAPH = { node: [{"node": neighbor, "weight": w}, ...] }
    NODES = { node: {"x": x, "y": y} }
    """
    custom_graph = {}
    custom_nodes = {}
    
    for node, data in G.nodes(data=True):
        custom_nodes[node] = {"x": data['x'], "y": data['y'], "lat": data['y'], "lng": data['x']}
        custom_graph[node] = []
        
    for u, v, data in G.edges(data=True):
        # Weight is usually 'length' in OSMnx
        weight = data.get('length', 1.0)
        custom_graph[u].append({"node": v, "weight": weight})
        
    return custom_graph, custom_nodes
