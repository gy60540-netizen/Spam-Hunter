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

def send_meta_dm(creator, comment_id: str, message_text: str):
    """Attempts sending Instagram Private Reply DM across Graph API endpoint variations."""
    payload = {
        "recipient": {
            "comment_id": comment_id
        },
        "message": {
            "text": message_text
        }
    }

    # Endpoint 1: Instagram Business User ID
    url1 = f"https://graph.facebook.com/v17.0/{creator.ig_user_id}/messages?access_token={creator.access_token}"
    res1 = requests.post(url1, json=payload)
    if res1.status_code == 200:
        return True, res1.text

    # Endpoint 2: /me/messages
    url2 = f"https://graph.facebook.com/v17.0/me/messages?access_token={creator.access_token}"
    res2 = requests.post(url2, json=payload)
    if res2.status_code == 200:
        return True, res2.text

    # Endpoint 3: Facebook Page ID
    if creator.fb_page_id:
        url3 = f"https://graph.facebook.com/v17.0/{creator.fb_page_id}/messages?access_token={creator.access_token}"
        res3 = requests.post(url3, json=payload)
        if res3.status_code == 200:
            return True, res3.text

    return False, res1.text


async def run_dm_queue_worker():
    """Continuous background loop processing queued DMs safely."""
    while True:
        try:
            db = SessionLocal()
            now = datetime.datetime.utcnow()
            pending_items = db.query(DMQueueItem).filter(
                DMQueueItem.status == "PENDING",
                DMQueueItem.scheduled_for <= now
            ).order_by(DMQueueItem.scheduled_for.asc()).limit(10).all()

            for item in pending_items:
                creator = db.query(Creator).filter(Creator.id == item.creator_id).first()
                if not creator:
                    item.status = "FAILED"
                    item.error_message = "Creator not found"
                    db.commit()
                    continue

                print(f"[Worker] Processing DM to @{item.recipient_username}: '{item.message_text[:30]}...'")

                await asyncio.sleep(1.5)

                if creator.is_mock or item.comment_id.startswith("c_") or item.comment_id.startswith("seed_"):
                    item.status = "SENT"
                    item.sent_at = datetime.datetime.utcnow()
                    print(f"[Worker] DM sent to @{item.recipient_username} successfully (SIMULATED).")
                else:
                    if not creator.access_token:
                        item.status = "FAILED"
                        item.error_message = "No Page Access Token found"
                        print(f"[Worker] DM to @{item.recipient_username} failed: No Page Access Token found")
                    elif not creator.ig_user_id:
                        item.status = "FAILED"
                        item.error_message = "No Instagram User ID found"
                        print(f"[Worker] DM to @{item.recipient_username} failed: No Instagram User ID found")
                    else:
                        success, err_msg = send_meta_dm(creator, item.comment_id, item.message_text)
                        if success:
                            item.status = "SENT"
                            item.sent_at = datetime.datetime.utcnow()
                            print(f"[Worker] DM sent to @{item.recipient_username} successfully.")
                        else:
                            item.status = "FAILED"
                            item.error_message = err_msg
                            print(f"[Worker] DM to @{item.recipient_username} failed: {err_msg}")
                
                db.commit()

            db.close()
        except Exception as e:
            print(f"[Worker Error] {str(e)}")
        
        await asyncio.sleep(3)


async def process_creator_pending_dms(creator_id: int):
    """
    Processes all pending DMs for a specific creator by waiting for their scheduled time.
    """
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        pending_items = db.query(DMQueueItem).filter(
            DMQueueItem.creator_id == creator_id,
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

            now = datetime.datetime.utcnow()
            time_to_wait = (item.scheduled_for - now).total_seconds()
            if time_to_wait > 0:
                print(f"[Serverless Worker] Waiting {time_to_wait:.2f}s for DM to @{item.recipient_username}...")
                await asyncio.sleep(min(time_to_wait, 6.0))

            print(f"[Worker] Processing DM to @{item.recipient_username}: '{item.message_text[:30]}...'")

            if creator.is_mock or item.comment_id.startswith("c_") or item.comment_id.startswith("seed_"):
                item.status = "SENT"
                item.sent_at = datetime.datetime.utcnow()
                print(f"[Worker] DM sent to @{item.recipient_username} successfully (SIMULATED).")
            else:
                if not creator.access_token:
                    item.status = "FAILED"
                    item.error_message = "No Page Access Token found"
                    print(f"[Worker] DM to @{item.recipient_username} failed: No Page Access Token found")
                elif not creator.ig_user_id:
                    item.status = "FAILED"
                    item.error_message = "No Instagram User ID found"
                    print(f"[Worker] DM to @{item.recipient_username} failed: No Instagram User ID found")
                else:
                    success, err_msg = send_meta_dm(creator, item.comment_id, item.message_text)
                    if success:
                        item.status = "SENT"
                        item.sent_at = datetime.datetime.utcnow()
                        print(f"[Worker] DM sent to @{item.recipient_username} successfully.")
                    else:
                        item.status = "FAILED"
                        item.error_message = err_msg
                        print(f"[Worker] DM to @{item.recipient_username} failed: {err_msg}")
            db.commit()
    except Exception as e:
        print(f"[Serverless Worker Error] {str(e)}")
    finally:
        db.close()
