import sys
import os
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.main import get_dashboard_analytics

db = SessionLocal()

try:
    print("Calling get_dashboard_analytics...")
    t = time.time()
    res = get_dashboard_analytics(creator_id=1, db=db)
    print("Result:", res)
    print("Completed in:", time.time() - t)
except Exception as e:
    print("Error:", e)
finally:
    db.close()
