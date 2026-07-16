import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.models import DMQueueItem
import datetime

db = SessionLocal()
now = datetime.datetime.utcnow()
print(f"Current UTC time (naive): {now}")

items = db.query(DMQueueItem).all()
print(f"Total items in queue: {len(items)}")
for item in items:
    print(f"Item ID: {item.id}, Recipient: {item.recipient_username}, Status: {item.status}, Scheduled For: {item.scheduled_for} (Type: {type(item.scheduled_for)})")
    is_ready = item.scheduled_for <= now
    print(f"  scheduled_for <= now? {is_ready}")
db.close()
