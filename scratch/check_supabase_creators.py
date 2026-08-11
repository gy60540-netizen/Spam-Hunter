import sys
import os
from dotenv import load_dotenv

# Load env variables from backend/.env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env")
load_dotenv(env_path)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.models import Creator

db = SessionLocal()
creators = db.query(Creator).all()
print(f"Total creators in Supabase DB: {len(creators)}")
for c in creators:
    print(f"ID: {c.id}, Username: {c.instagram_username}, is_mock: {c.is_mock}")
db.close()
