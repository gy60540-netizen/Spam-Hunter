import sys
import os
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.models import Creator, MediaPost, Comment, Commenter

db = SessionLocal()

print("Connected to DB.")
creator_id = 1

try:
    t = time.time()
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    print("Fetched creator in", time.time() - t)
    
    t = time.time()
    posts = db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()
    print(f"Fetched {len(posts)} posts in", time.time() - t)
    
    post_ids = [p.id for p in posts]
    
    t = time.time()
    total_comments = db.query(Comment).filter(Comment.media_id.in_(post_ids)).count()
    print(f"Counted {total_comments} comments in", time.time() - t)

    t = time.time()
    total_users = db.query(Commenter).filter(Commenter.creator_id == creator_id).count()
    print(f"Counted {total_users} commenters in", time.time() - t)
    
    t = time.time()
    spam_comments = db.query(Comment).filter(
        Comment.media_id.in_(post_ids),
        Comment.category.in_(["Flood Spam", "Duplicate Spam", "Emoji Spam"])
    ).count()
    print(f"Counted {spam_comments} spam comments in", time.time() - t)

except Exception as e:
    print("Error:", e)
finally:
    db.close()
