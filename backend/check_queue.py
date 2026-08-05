import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')
raw_url = os.getenv('DATABASE_URL')
db_url = raw_url.replace('"', '').split('?')[0]
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute('SELECT id, recipient_username, comment_id, status, error_message FROM dm_queue;')
items = cur.fetchall()
print(f"DM QUEUE ITEMS COUNT: {len(items)}")
for it in items:
    print(it)
