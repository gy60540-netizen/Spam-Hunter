import requests

BASE_URL = "http://127.0.0.1:8000/api"

endpoints = [
    "/creators/1",
    "/posts/1",
    "/posts/18096587818854271/comments",
    "/analytics/1",
    "/commenters/1",
    "/queue/1",
    "/loyalty/1"
]

for ep in endpoints:
    url = BASE_URL + ep
    try:
        res = requests.get(url, timeout=5)
        print(f"GET {ep} -> Status: {res.status_code}")
        if res.status_code != 200:
            print("  Body:", res.text)
    except Exception as e:
        print(f"GET {ep} -> Failed: {e}")
