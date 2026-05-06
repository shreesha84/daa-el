import json
from algorithms import ALGORITHMS

def main():
    print("Algorithm Execution Tester")
    print("-" * 30)
    
    source = input("Enter source node (e.g., A): ").strip().upper()
    destination = input("Enter destination node (e.g., J): ").strip().upper()
    
    if not source or not destination:
        print("Source and destination must be provided.")
        return
        
    for key, algorithm_func in ALGORITHMS.items():
        print(f"\n--- Running {key.capitalize()} ---")
        try:
            result = algorithm_func(source, destination)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()
