import asyncio
import json
import random
import datetime
import requests
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import Creator, DMQueueItem, Comment

# Predefined fallback templates in case the creator hasn't set any templates
DEFAULT_TEMPLATES = [
    "Hey @{username}, thank you for asking! I've sent the details to your inbox.",
    "Hi @{username}! Thanks for commenting. Check your DMs for the exclusive link!",
    "Hello @{username}, absolutely! Sending you the details right away.",
    "Hey @{username}, appreciate the support! Sending the link to your DMs now.",
    "Hi @{username}, thanks! I have messaged you the details. Let me know if you got it!"
]

DEFAULT_LEAD_TEMPLATES = [
    "Hey @{username}, thanks for asking! Sent details of pricing & checkout link to your DMs 📦",
    "Hi @{username}! I've messaged you the details & purchase link. Please check your inbox requests!",
    "Hello @{username}, details sent! Check your message requests for the link. 🛒",
    "Hey @{username}! Sent you a DM with all details + discount code! Let me know if you get it."
]

def enqueue_dm(db: Session, creator_id: int, recipient_username: str, comment_id: str) -> DMQueueItem:
    """
    Adds a new DM to the queue with template rotation, personalized variables, 
    and a spaced out scheduled time (Jitter). Supports separate Lead templates.
    """
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        return None

    # Fetch comment category to determine which template bank to use
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    category = comment.category if comment else "Normal"

    # 1. Retrieve templates or fallback based on category
    if category == "Lead":
        try:
            templates = json.loads(creator.lead_dm_templates) if creator.lead_dm_templates else DEFAULT_LEAD_TEMPLATES
            if not isinstance(templates, list) or len(templates) == 0:
                templates = DEFAULT_LEAD_TEMPLATES
        except Exception:
            templates = DEFAULT_LEAD_TEMPLATES
    else:
        try:
            templates = json.loads(creator.dm_templates) if creator.dm_templates else DEFAULT_TEMPLATES
            if not isinstance(templates, list) or len(templates) == 0:
                templates = DEFAULT_TEMPLATES
        except Exception:
            templates = DEFAULT_TEMPLATES

    # 2. Select a template randomly to prevent patterns
    message_template = random.choice(templates)

    # 3. Replace personalized variables
    message_text = message_template.replace("{username}", recipient_username)

    # 4. Smart Scheduling / Delay spacing
    now = datetime.datetime.utcnow()
    
    # Check if there is already a DM scheduled in the future for this creator
    latest_item = db.query(DMQueueItem).filter(
        DMQueueItem.creator_id == creator_id,
        DMQueueItem.status == "PENDING"
    ).order_by(DMQueueItem.scheduled_for.desc()).first()

    # Calculate random delay (jitter): 3 to 5 seconds
    delay_seconds = random.randint(3, 5)

    if latest_item and latest_item.scheduled_for > now:
        # Schedule it after the latest item with additional random delay
        scheduled_for = latest_item.scheduled_for + datetime.timedelta(seconds=delay_seconds)
    else:
        # Schedule it starting from now + random delay
        scheduled_for = now + datetime.timedelta(seconds=delay_seconds)

    # 5. Create queue item
    new_item = DMQueueItem(
        creator_id=creator_id,
        recipient_username=recipient_username,
        comment_id=comment_id,
        message_text=message_text,
        status="PENDING",
        scheduled_for=scheduled_for
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    return new_item

async def run_dm_queue_worker():
    """
    Background worker loop that runs continuously.
    It checks the queue for pending items that are ready to be sent.
    """
    print("DM Queue Worker Started...")
    while True:
        try:
            # Create a new DB session for this iteration
            db = SessionLocal()
            now = datetime.datetime.utcnow()

            # Find all pending queue items whose scheduled time has passed
            pending_items = db.query(DMQueueItem).filter(
                DMQueueItem.status == "PENDING",
                DMQueueItem.scheduled_for <= now
            ).order_by(DMQueueItem.scheduled_for.asc()).all()

            for item in pending_items:
                creator = db.query(Creator).filter(Creator.id == item.creator_id).first()
                if not creator:
                    item.status = "FAILED"
                    item.error_message = "Creator not found"
                    db.commit()
                    continue

                print(f"[Worker] Processing DM to @{item.recipient_username}: '{item.message_text[:30]}...'")

                # Simulate API Call delay
                await asyncio.sleep(1.5)

                if creator.is_mock:
                    # Simulation Mode: success
                    item.status = "SENT"
                    item.sent_at = datetime.datetime.utcnow()
                    print(f"[Worker] DM sent to @{item.recipient_username} successfully (MOCK).")
                else:
                    # Real mode: Integrate real Instagram Graph API Call
                    if not creator.access_token:
                        item.status = "FAILED"
                        item.error_message = "No Page Access Token found"
                        print(f"[Worker] DM to @{item.recipient_username} failed: No Page Access Token found")
                    else:
                        if not creator.ig_user_id:
                            item.status = "FAILED"
                            item.error_message = "No Instagram User ID found"
                            print(f"[Worker] DM to @{item.recipient_username} failed: No Instagram User ID found")
                        else:
                            url = f"https://graph.facebook.com/v17.0/{creator.ig_user_id}/messages?access_token={creator.access_token}"
                            payload = {
                                "recipient": {
                                    "comment_id": item.comment_id
                                },
                                "message": {
                                    "text": item.message_text
                                }
                            }
                        res = requests.post(url, json=payload)
                        if res.status_code == 200:
                            item.status = "SENT"
                            item.sent_at = datetime.datetime.utcnow()
                            print(f"[Worker] DM sent to @{item.recipient_username} successfully.")
                        else:
                            item.status = "FAILED"
                            item.error_message = res.text
                            print(f"[Worker] DM to @{item.recipient_username} failed: {res.text}")
                
                db.commit()

            db.close()
        except Exception as e:
            print(f"[Worker Error] {str(e)}")
        
        # Check database every 3 seconds
        await asyncio.sleep(3)
