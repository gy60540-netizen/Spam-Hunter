import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.models import Creator

db = SessionLocal()
c = db.query(Creator).filter(Creator.id == 2).first()
if c:
    print(f"ID: {c.id}")
    print(f"Username: {c.instagram_username}")
    print(f"is_mock: {c.is_mock}")
    print(f"fb_page_id: {c.fb_page_id}")
    print(f"ig_user_id: {c.ig_user_id}")
    print(f"access_token: {c.access_token}")
    print(f"long_lived_token: {c.long_lived_token}")
else:
    print("Creator 2 not found")
db.close()
