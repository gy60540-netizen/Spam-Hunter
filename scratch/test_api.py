import requests
import time

try:
    start = time.time()
    res = requests.get("http://127.0.0.1:8000/api/auth/config", timeout=5)
    print("Status code:", res.status_code)
    print("Response time:", time.time() - start)
    print("Body:", res.json() if res.status_code == 200 else res.text)
except Exception as e:
    print("Request failed:", e)
