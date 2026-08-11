import requests
import time

try:
    start = time.time()
    res = requests.post("http://127.0.0.1:8000/api/creators/2/sync", timeout=10)
    print("Status code:", res.status_code)
    print("Response time:", time.time() - start)
    print("Body:", res.json())
except Exception as e:
    print("Request failed:", e)
