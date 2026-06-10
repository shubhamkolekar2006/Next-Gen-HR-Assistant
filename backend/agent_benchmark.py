import asyncio
import time
import httpx
from statistics import mean

# Define the base URL where your FastAPI backend is running
BASE_URL = "http://localhost:8000/api/v1"

# A list of test queries to benchmark your agent's different capabilities
TEST_QUERIES = [
    "What is the total number of employees?",
    "Who is in the Engineering department?",
    "Show me the employees with high attrition risk",
    "What is the average salary of employees?",
    "Tell me a joke", # Edge case / out of domain query
]

async def measure_query_performance(client: httpx.AsyncClient, query: str):
    """Measures the latency and success of a single query."""
    start_time = time.time()
    success = False
    error_msg = None
    
    try:
        response = await client.post(
            f"{BASE_URL}/chatbot/ask",
            json={"query": query},
            timeout=30.0 # Agents can take a while to respond
        )
        
        latency = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            success = data.get("success", False)
        else:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            
    except Exception as e:
        latency = time.time() - start_time
        error_msg = str(e)
        
    return {
        "query": query,
        "latency_seconds": round(latency, 3),
        "success": success,
        "error": error_msg
    }

async def run_benchmark():
    """Runs a suite of queries and calculates overall agent performance."""
    print(f"Starting Agent Performance Benchmark with {len(TEST_QUERIES)} queries...\n")
    
    results = []
    async with httpx.AsyncClient() as client:
        for query in TEST_QUERIES:
            print(f"Testing: '{query}'")
            result = await measure_query_performance(client, query)
            results.append(result)
            
            # Print intermediate results
            status = "✅ PASS" if result['success'] else f"❌ FAIL ({result['error']})"
            print(f"  Result: {status} | Latency: {result['latency_seconds']}s\n")
            
            # Add a small delay between requests
            await asyncio.sleep(1)
            
    # Calculate aggregate metrics
    latencies = [r['latency_seconds'] for r in results if r['success']]
    success_rate = sum(1 for r in results if r['success']) / len(results) * 100
    
    print("-" * 40)
    print("📊 AGENT PERFORMANCE REPORT")
    print("-" * 40)
    print(f"Total Queries Run: {len(results)}")
    print(f"Success Rate:      {success_rate:.1f}%")
    
    if latencies:
        print(f"Average Latency:   {mean(latencies):.3f}s")
        print(f"Min Latency:       {min(latencies):.3f}s")
        print(f"Max Latency:       {max(latencies):.3f}s")
    else:
        print("Latency:           N/A (All queries failed)")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
