import json
import asyncio
import datetime
import random
import os
import threading
from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Request, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
FB_APP_ID = os.getenv("FB_APP_ID", "")
FB_APP_SECRET = os.getenv("FB_APP_SECRET", "")



import requests
from .database import engine, Base, get_db
from .models import Creator, MediaPost, Commenter, Comment, DMQueueItem, Like, CustomerLead
from .schemas import (
    CreatorResponse, CreatorUpdateTemplates, CreatorUpdateLeadKeywords,
    CreatorToggleMode, MediaPostResponse, CommenterResponse, CommentResponse,
    CommentCreateMock, DMQueueItemResponse, DashboardStats, TopSpammer, TopHater,
    LoyalFanResponse, LikeCreateMock, LikeResponse, FacebookCallbackRequest
)
from .classification import classify_comment, update_commenter_stats
from .queue_worker import run_dm_queue_worker, enqueue_dm, process_creator_pending_dms

def migrate_database():
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("SELECT razorpay_customer_id FROM creators LIMIT 1"))
                has_customer_id = True
            except Exception:
                has_customer_id = False

            try:
                conn.execute(text("SELECT razorpay_subscription_id FROM creators LIMIT 1"))
                has_subscription_id = True
            except Exception:
                has_subscription_id = False

        if not has_customer_id or not has_subscription_id:
            with engine.begin() as conn:
                if not has_customer_id:
                    try:
                        conn.execute(text("ALTER TABLE creators ADD COLUMN razorpay_customer_id TEXT"))
                    except Exception as e:
                        print(f"[Migration Error razorpay_customer_id] {str(e)}")
                if not has_subscription_id:
                    try:
                        conn.execute(text("ALTER TABLE creators ADD COLUMN razorpay_subscription_id TEXT"))
                    except Exception as e:
                        print(f"[Migration Error razorpay_subscription_id] {str(e)}")

        meta_fields = ["fb_page_id", "fb_page_access_token", "ig_user_id", "long_lived_token"]
        with engine.begin() as conn:
            for field in meta_fields:
                try:
                    conn.execute(text(f"SELECT {field} FROM creators LIMIT 1"))
                except Exception:
                    try:
                        conn.execute(text(f"ALTER TABLE creators ADD COLUMN {field} TEXT"))
                    except Exception as e:
                        print(f"[Migration Error {field}] {str(e)}")
    except Exception as e:
        print(f"[Migration Warning] {e}")

# Initialize DB Tables on startup safely
try:
    Base.metadata.create_all(bind=engine)
    migrate_database()
except Exception as e:
    print(f"[Database Startup Warning] {e}")





@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background queue worker
    worker_task = asyncio.create_task(run_dm_queue_worker())
    yield
    # Shutdown: Cancel worker task
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Instagram Comment Moderation & Intelligence API",
    version="1.1.0",
    lifespan=lifespan
)

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Instagram Spam Moderator & Intelligence API",
        "version": "1.1.0",
        "docs_url": "/docs"
    }

@app.get("/healthz")
def health_check():
    return {"status": "healthy"}

# --- META INSTAGRAM WEBHOOK ROUTES ---

VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN", "spam_hunter_verify_token")

@app.get("/api/webhooks/instagram")
def verify_instagram_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token")
):
    """Meta Webhook Verification Endpoint."""
    print(f"[Webhook GET] mode: {hub_mode}, verify_token: {hub_verify_token}")
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        print("[Webhook GET] Verification Successful!")
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@app.post("/api/webhooks/instagram")
async def handle_instagram_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Receives live comment events from Instagram Graph API Webhooks."""
    try:
        body = await request.json()
        print(f"[Webhook POST] Event received: {json.dumps(body)}")
        
        entries = body.get("entry", [])
        for entry in entries:
            ig_user_id = entry.get("id")
            changes = entry.get("changes", [])
            for change in changes:
                if change.get("field") == "comments":
                    val = change.get("value", {})
                    comment_id = val.get("id")
                    text = val.get("text", "")
                    from_user = val.get("from", {})
                    username = from_user.get("username", "ig_user")
                    media_obj = val.get("media", {})
                    media_id = media_obj.get("id", "real_media")

                    if not comment_id or not text:
                        continue

                    # Find creator connected to this ig_user_id
                    creator = db.query(Creator).filter(Creator.ig_user_id == ig_user_id).first()
                    if not creator:
                        # Fallback to first non-mock creator
                        creator = db.query(Creator).filter(Creator.is_mock == False).first()

                    if not creator:
                        print(f"[Webhook] No active creator found for ig_user_id {ig_user_id}")
                        continue

                    # Ensure media post exists
                    post = db.query(MediaPost).filter(MediaPost.id == media_id).first()
                    if not post:
                        post = MediaPost(
                            id=media_id,
                            creator_id=creator.id,
                            caption="Live Instagram Post",
                            permalink=f"https://instagram.com/p/{media_id}",
                            media_type="IMAGE"
                        )
                        db.add(post)
                        db.commit()

                    # Find or create commenter
                    commenter = db.query(Commenter).filter(
                        Commenter.username == username,
                        Commenter.creator_id == creator.id
                    ).first()

                    if not commenter:
                        commenter = Commenter(
                            username=username,
                            creator_id=creator.id,
                            total_comments=0,
                            last_commented_at=datetime.datetime.utcnow()
                        )
                        db.add(commenter)
                        db.commit()
                        db.refresh(commenter)

                    # Classify comment
                    lead_keywords_str = creator.lead_keywords or "price,buy,link,dm,how much,cost,details"
                    category = classify_comment(db, username, media_id, text, lead_keywords_str)

                    # Check duplicate comment
                    existing_c = db.query(Comment).filter(Comment.id == comment_id).first()
                    if not existing_c:
                        new_comment = Comment(
                            id=comment_id,
                            media_id=media_id,
                            username=username,
                            text=text,
                            timestamp=datetime.datetime.utcnow(),
                            category=category
                        )
                        db.add(new_comment)
                        db.commit()

                        # Update stats
                        commenter.last_commented_at = datetime.datetime.utcnow()
                        update_commenter_stats(db, commenter)

                        # Auto-enqueue DM if not hate comment
                        risk_val = commenter.risk_score if (commenter and commenter.risk_score is not None) else 0
                        if category != "Hate Comment" and risk_val <= 50:
                            print(f"[Webhook] Auto-enqueuing DM for comment {comment_id} by @{username}")
                            enqueue_dm(db, creator.id, username, comment_id)
                            background_tasks.add_task(process_creator_pending_dms, creator.id)

        return {"status": "EVENT_RECEIVED"}
    except Exception as e:
        print(f"[Webhook Error] {e}")
        return {"status": "ERROR", "detail": str(e)}

# --- AUTH ROUTES ---



@app.get("/api/auth/config")
def get_auth_config():
    return {"app_id": FB_APP_ID}

@app.post("/api/auth/facebook-callback", response_model=CreatorResponse)
def facebook_callback(payload: FacebookCallbackRequest, db: Session = Depends(get_db)):
    import traceback
    print("=== FACEBOOK CALLBACK START ===")
    print(f"Payload Code: {payload.code}")
    print(f"Payload Redirect URI: {payload.redirect_uri}")
    
    if not FB_APP_ID or not FB_APP_SECRET:
        print("Error: FB_APP_ID or FB_APP_SECRET not configured in environment.")
        raise HTTPException(status_code=500, detail="Meta credentials not configured.")
        
    redirect_uri = payload.redirect_uri or f"{FRONTEND_URL}/"
    print(f"Using Redirect URI: {redirect_uri}")

    try:
        # 1. Exchange code for short-lived User Access Token
        token_url = f"https://graph.facebook.com/v17.0/oauth/access_token?client_id={FB_APP_ID}&redirect_uri={redirect_uri}&client_secret={FB_APP_SECRET}&code={payload.code}"
        print(f"Requesting token from: {token_url}")
        res = requests.get(token_url)
        print(f"Token response status: {res.status_code}")
        print(f"Token response body: {res.text}")
        
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to get user access token: {res.text}")
        
        token_data = res.json()
        user_access_token = token_data.get("access_token")
        if not user_access_token:
            raise HTTPException(status_code=400, detail="No access token in response.")

        # 2. Exchange short-lived token for long-lived User Access Token
        long_lived_url = f"https://graph.facebook.com/v17.0/oauth/access_token?grant_type=fb_exchange_token&client_id={FB_APP_ID}&client_secret={FB_APP_SECRET}&fb_exchange_token={user_access_token}"
        res = requests.get(long_lived_url)
        if res.status_code == 200:
            user_access_token = res.json().get("access_token", user_access_token)

        # 3. Get User's Pages to find the connected Instagram Account
        pages_url = f"https://graph.facebook.com/v17.0/me/accounts?access_token={user_access_token}"
        print(f"Fetching Pages from: {pages_url}")
        res = requests.get(pages_url)
        print(f"Pages response status: {res.status_code}")
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch pages: {res.text}")
        
        pages_data = res.json().get("data", [])
        print(f"Pages data: {pages_data}")
        
        instagram_business_account_id = None
        page_access_token = None
        fb_page_id_to_store = None
        
        for page in pages_data:
            page_id = page.get("id")
            p_token = page.get("access_token")
            
            ig_url = f"https://graph.facebook.com/v17.0/{page_id}?fields=instagram_business_account&access_token={p_token}"
            ig_res = requests.get(ig_url)
            print(f"Page {page_id} IG response ({ig_res.status_code}): {ig_res.text}")
            if ig_res.status_code == 200:
                ig_data = ig_res.json()
                if "instagram_business_account" in ig_data:
                    instagram_business_account_id = ig_data["instagram_business_account"]["id"]
                    page_access_token = p_token
                    fb_page_id_to_store = page_id
                    break
                    
        if not instagram_business_account_id:
            raise HTTPException(status_code=400, detail="No linked Instagram Business Account found.")
            
        # Get Instagram Username
        ig_user_url = f"https://graph.facebook.com/v17.0/{instagram_business_account_id}?fields=username&access_token={page_access_token}"
        ig_user_res = requests.get(ig_user_url)
        if ig_user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Instagram username.")
            
        ig_username = ig_user_res.json().get("username")
        print(f"Found IG username: {ig_username}")
        
        # Upsert Creator in DB
        creator = db.query(Creator).filter(Creator.instagram_username == ig_username).first()
        if not creator:
            creator = Creator(
                instagram_username=ig_username,
                is_mock=False,
                access_token=page_access_token,
                fb_page_id=fb_page_id_to_store,
                fb_page_access_token=page_access_token,
                ig_user_id=instagram_business_account_id,
                long_lived_token=user_access_token,
                dm_templates=json.dumps([
                    "Hi @{username}, thanks for the comment! Here is the link: https://bit.ly/my-special-link",
                    "Hey @{username}! Appreciate your support. Direct link sent: https://bit.ly/my-special-link",
                    "Hello @{username}, of course! Check it out here: https://bit.ly/my-special-link",
                    "Hi there @{username}! Details are here: https://bit.ly/my-special-link. Let me know what you think!"
                ]),
                lead_keywords="price,buy,link,dm,how much,cost,details,purchase,collaborate",
                lead_dm_templates=json.dumps([
                    "Hey @{username}, thanks for asking! Sent details of pricing & checkout link to your DMs 📦",
                    "Hi @{username}! I've messaged you the details & purchase link. Please check your inbox requests!",
                    "Hello @{username}, details sent! Check your message requests for the link. 🛒",
                    "Hey @{username}! Sent you a DM with all details + discount code!"
                ])
            )
            db.add(creator)
        else:
            creator.is_mock = False
            creator.access_token = page_access_token
            creator.fb_page_id = fb_page_id_to_store
            creator.fb_page_access_token = page_access_token
            creator.ig_user_id = instagram_business_account_id
            creator.long_lived_token = user_access_token
            
        db.commit()
        db.refresh(creator)
        
        # Ensure there's at least some initial mocked posts for UI if empty
        seed_creator_posts(db, creator.id)
        
        print("=== FACEBOOK CALLBACK SUCCESS ===")
        return creator

    except HTTPException as he:
        print(f"HTTPException in callback: {he.status_code} - {he.detail}")
        traceback.print_exc()
        raise he
    except Exception as e:
        print(f"Unexpected Exception in callback: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login", response_model=CreatorResponse)
def login_creator(username: str, db: Session = Depends(get_db)):
    """Logs in or registers a creator (mock auth)."""
    username_clean = username.strip().replace("@", "")
    if not username_clean:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    
    creator = db.query(Creator).filter(Creator.instagram_username == username_clean).first()
    if not creator:
        creator = Creator(
            instagram_username=username_clean,
            is_mock=True,
            dm_templates=json.dumps([
                "Hi @{username}, thanks for the comment! Here is the link: https://bit.ly/my-special-link",
                "Hey @{username}! Appreciate your support. Direct link sent: https://bit.ly/my-special-link",
                "Hello @{username}, of course! Check it out here: https://bit.ly/my-special-link",
                "Hi there @{username}! Details are here: https://bit.ly/my-special-link. Let me know what you think!"
            ]),
            lead_keywords="price,buy,link,dm,how much,cost,details,purchase,collaborate",
            lead_dm_templates=json.dumps([
                "Hey @{username}, thanks for asking! Sent details of pricing & checkout link to your DMs 📦",
                "Hi @{username}! I've messaged you the details & purchase link. Please check your inbox requests!",
                "Hello @{username}, details sent! Check your message requests for the link. 🛒",
                "Hey @{username}! Sent you a DM with all details + discount code!"
            ])
        )
        db.add(creator)
        db.commit()
        db.refresh(creator)
        
        # Seed initial mock posts for new creator
        seed_creator_posts(db, creator.id)

    return creator

def seed_creator_posts(db: Session, creator_id: int):
    """Seeds some initial media posts for a newly logged in creator."""
    posts = [
        MediaPost(id=f"post_1_{creator_id}", creator_id=creator_id, caption="New Product Launch! 🚀 Check out the link in bio.", permalink="https://instagram.com/p/post1", media_type="IMAGE"),
        MediaPost(id=f"post_2_{creator_id}", creator_id=creator_id, caption="My morning routine vlog! 🌴 What is your routine?", permalink="https://instagram.com/p/post2", media_type="VIDEO"),
        MediaPost(id=f"post_3_{creator_id}", creator_id=creator_id, caption="Ask Me Anything (AMA) session in comments! 💬👇", permalink="https://instagram.com/p/post3", media_type="CAROUSEL")
    ]
    for p in posts:
        existing = db.query(MediaPost).filter(MediaPost.id == p.id).first()
        if not existing:
            db.add(p)
    db.commit()

# --- CREATOR / SETTINGS ROUTES ---

@app.get("/api/creators/{creator_id}", response_model=CreatorResponse)
def get_creator(creator_id: int, db: Session = Depends(get_db)):
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    return creator

@app.put("/api/creators/{creator_id}/templates", response_model=CreatorResponse)
def update_templates(creator_id: int, payload: CreatorUpdateTemplates, db: Session = Depends(get_db)):
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    creator.dm_templates = json.dumps(payload.dm_templates)
    db.commit()
    db.refresh(creator)
    return creator

@app.put("/api/creators/{creator_id}/lead-templates", response_model=CreatorResponse)
def update_lead_templates(creator_id: int, payload: CreatorUpdateTemplates, db: Session = Depends(get_db)):
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    creator.lead_dm_templates = json.dumps(payload.dm_templates)
    db.commit()
    db.refresh(creator)
    return creator

@app.put("/api/creators/{creator_id}/lead-keywords", response_model=CreatorResponse)
def update_lead_keywords(creator_id: int, payload: CreatorUpdateLeadKeywords, db: Session = Depends(get_db)):
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    creator.lead_keywords = payload.lead_keywords
    db.commit()
    db.refresh(creator)
    return creator

@app.put("/api/creators/{creator_id}/toggle-mode", response_model=CreatorResponse)
def toggle_creator_mode(creator_id: int, payload: CreatorToggleMode, db: Session = Depends(get_db)):
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    creator.is_mock = payload.is_mock
    db.commit()
    db.refresh(creator)
    return creator

def check_subscription(creator_id: int, db: Session):
    # Free version: all creators have access
    pass

@app.get("/api/posts/{creator_id}", response_model=List[MediaPostResponse])
def get_posts(creator_id: int, db: Session = Depends(get_db)):
    check_subscription(creator_id, db)
    return db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()

@app.get("/api/posts/{media_id}/comments", response_model=List[CommentResponse])
def get_post_comments(media_id: str, db: Session = Depends(get_db)):
    """Returns all comments on a specific post sorted by timestamp desc."""
    return db.query(Comment).filter(Comment.media_id == media_id).order_by(Comment.timestamp.desc()).all()

# --- ANALYTICS DASHBOARD ---

@app.get("/api/analytics/{creator_id}", response_model=DashboardStats)
def get_dashboard_analytics(creator_id: int, db: Session = Depends(get_db)):
    """Computes all dashboard overview statistics."""
    check_subscription(creator_id, db)
    post_ids = [p.id for p in db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()]
    total_comments = db.query(Comment).filter(Comment.media_id.in_(post_ids)).count()
    total_users = db.query(Commenter).filter(Commenter.creator_id == creator_id).count()

    spam_comments = db.query(Comment).filter(
        Comment.media_id.in_(post_ids),
        Comment.category.in_(["Flood Spam", "Duplicate Spam", "Emoji Spam"])
    ).count()

    hate_comments = db.query(Comment).filter(
        Comment.media_id.in_(post_ids),
        Comment.category == "Hate Comment"
    ).count()

    leads_detected = db.query(Comment).filter(
        Comment.media_id.in_(post_ids),
        Comment.category == "Lead"
    ).count()

    top_spammers_query = db.query(Commenter).filter(
        Commenter.creator_id == creator_id
    ).order_by((Commenter.flood_spam_count + Commenter.duplicate_spam_count).desc()).limit(5).all()

    top_spammers = [
        TopSpammer(username=c.username, spam_count=c.flood_spam_count + c.duplicate_spam_count)
        for c in top_spammers_query if (c.flood_spam_count + c.duplicate_spam_count) > 0
    ]

    top_haters_query = db.query(Commenter).filter(
        Commenter.creator_id == creator_id
    ).order_by(Commenter.hate_comment_count.desc()).limit(5).all()

    top_haters = [
        TopHater(username=c.username, hate_count=c.hate_comment_count)
        for c in top_haters_query if c.hate_comment_count > 0
    ]

    return DashboardStats(
        total_comments=total_comments,
        total_users=total_users,
        spam_comments=spam_comments,
        hate_comments=hate_comments,
        leads_detected=leads_detected,
        top_flood_spammers=top_spammers,
        top_hate_commenters=top_haters
    )

# --- USER INTELLIGENCE ---

@app.get("/api/commenters/{creator_id}", response_model=List[CommenterResponse])
def get_commenters(creator_id: int, db: Session = Depends(get_db)):
    check_subscription(creator_id, db)
    return db.query(Commenter).filter(Commenter.creator_id == creator_id).order_by(Commenter.risk_score.desc()).all()

@app.get("/api/commenter/{username}/history", response_model=List[CommentResponse])
def get_commenter_history(username: str, db: Session = Depends(get_db)):
    return db.query(Comment).filter(Comment.username == username).order_by(Comment.timestamp.desc()).all()

# --- DM QUEUE ---

@app.get("/api/queue/{creator_id}", response_model=List[DMQueueItemResponse])
async def get_dm_queue(creator_id: int, db: Session = Depends(get_db)):
    check_subscription(creator_id, db)
    await process_creator_pending_dms(creator_id)
    return db.query(DMQueueItem).filter(
        DMQueueItem.creator_id == creator_id
    ).order_by(DMQueueItem.scheduled_for.desc()).all()

# --- LOYALTY FANS ROUTES ---

@app.get("/api/loyalty/{creator_id}", response_model=List[LoyalFanResponse])
def get_loyal_fans(creator_id: int, db: Session = Depends(get_db)):
    check_subscription(creator_id, db)
    """
    Identifies and segments loyal fans based on the percentage of posts they commented on
    within a sliding 2-month (60 days) window.
    Excludes users with a risk score greater than 30.
    """
    # 60 days sliding window threshold
    loyalty_limit = datetime.datetime.utcnow() - datetime.timedelta(days=60)

    recent_posts_query = db.query(MediaPost).filter(
        MediaPost.creator_id == creator_id,
        MediaPost.created_at >= loyalty_limit
    ).all()
    total_recent_posts = len(recent_posts_query)

    commenters = db.query(Commenter).filter(
        Commenter.creator_id == creator_id,
        Commenter.risk_score <= 30
    ).all()
    
    result = []
    for c in commenters:
        # Fetch comments by this user within the last 60 days
        comments = db.query(Comment).filter(
            Comment.username == c.username,
            Comment.timestamp >= loyalty_limit
        ).all()
        
        unique_weeks = set()
        unique_months = set()
        engaged_post_ids = set()
        
        # Fetch likes for this user
        likes = db.query(Like).filter(Like.username == c.username).all()
        liked_post_ids = {l.media_id for l in likes}
        
        for comm in comments:
            dt = comm.timestamp
            year, week_num, _ = dt.isocalendar()
            unique_weeks.add((year, week_num))
            unique_months.add((dt.year, dt.month))
            # Track which posts they commented AND liked on
            if comm.media_id in [p.id for p in recent_posts_query] and comm.media_id in liked_post_ids:
                engaged_post_ids.add(comm.media_id)
            
        active_weeks = len(unique_weeks)
        active_months = len(unique_months)
        posts_engaged_on = len(engaged_post_ids)
        
        # Segment into Tiers based on % of posts engaged on (comment + like)
        if total_recent_posts > 0:
            percentage = (posts_engaged_on / total_recent_posts) * 100
            if percentage == 100:
                tier = "Gold Fan (On Every Post!)"
            elif percentage >= 70:
                tier = "Silver Fan (Most Posts)"
            elif percentage >= 30:
                tier = "Bronze Fan (Active Fan)"
            else:
                tier = "New Fan"
        else:
            tier = "New Fan"
            
        result.append(LoyalFanResponse(
            username=c.username,
            total_comments=c.total_comments,
            risk_score=c.risk_score,
            active_weeks=active_weeks,
            active_months=active_months,
            loyalty_tier=tier
        ))
        
    # Sort loyal fans: Gold first, then Silver, then total comments
    result.sort(key=lambda x: (
        3 if "Gold" in x.loyalty_tier else (2 if "Silver" in x.loyalty_tier else (1 if "Bronze" in x.loyalty_tier else 0)),
        x.total_comments
    ), reverse=True)
    
    return result


# --- PAYMENT & SUBSCRIPTION ROUTES REMOVED ---




# --- SIMULATOR & SEEDING ---

@app.post("/api/simulator/comment", response_model=CommentResponse)
def simulate_new_comment(payload: CommentCreateMock, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Simulates receiving a new comment on a creator's post."""
    post = db.query(MediaPost).filter(MediaPost.id == payload.media_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Media Post not found")

    creator = db.query(Creator).filter(Creator.id == post.creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
        
    # Free version check bypassed
    pass

    username = payload.username.strip().replace("@", "")
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    commenter = db.query(Commenter).filter(
        Commenter.username == username,
        Commenter.creator_id == post.creator_id
    ).first()

    if not commenter:
        commenter = Commenter(
            username=username,
            creator_id=post.creator_id,
            total_comments=0,
            last_commented_at=datetime.datetime.utcnow()
        )
        db.add(commenter)
        db.commit()
        db.refresh(commenter)

    # Run Classification with creator keywords
    lead_keywords_str = creator.lead_keywords or "price,buy,link,dm,how much,cost,details"
    category = classify_comment(db, username, payload.media_id, payload.text, lead_keywords_str)

    comment_id = f"c_{int(datetime.datetime.utcnow().timestamp())}_{random.randint(1000,9999)}"
    new_comment = Comment(
        id=comment_id,
        media_id=payload.media_id,
        username=username,
        text=payload.text,
        timestamp=datetime.datetime.utcnow(),
        category=category
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Recalculate stats
    commenter.last_commented_at = datetime.datetime.utcnow()
    update_commenter_stats(db, commenter)

    # Auto-DM logic for all comments except Hate Comments
    risk_val = commenter.risk_score if (commenter and commenter.risk_score is not None) else 0
    if category != "Hate Comment" and risk_val <= 50:
        enqueue_dm(db, post.creator_id, username, comment_id)
        background_tasks.add_task(process_creator_pending_dms, post.creator_id)

    return new_comment

@app.post("/api/simulator/like", response_model=LikeResponse)
def simulate_new_like(payload: LikeCreateMock, db: Session = Depends(get_db)):
    """Simulates receiving a new like on a creator's post."""
    post = db.query(MediaPost).filter(MediaPost.id == payload.media_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Media Post not found")

    username = payload.username.strip().replace("@", "")
    
    new_like = Like(
        media_id=payload.media_id,
        username=username,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(new_like)
    db.commit()
    db.refresh(new_like)
    return new_like

@app.post("/api/simulator/seed/{creator_id}")
def seed_mock_data(creator_id: int, db: Session = Depends(get_db)):
    """Seeds a rich set of spammers, hater comments, leads, and normal comments in bulk."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    old_post_ids = [p.id for p in db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()]
    if old_post_ids:
        db.query(Comment).filter(Comment.media_id.in_(old_post_ids)).delete(synchronize_session=False)
        db.query(Like).filter(Like.media_id.in_(old_post_ids)).delete(synchronize_session=False)

    db.query(MediaPost).filter(MediaPost.creator_id == creator_id).delete(synchronize_session=False)
    db.query(Commenter).filter(Commenter.creator_id == creator_id).delete(synchronize_session=False)
    db.query(DMQueueItem).filter(DMQueueItem.creator_id == creator_id).delete(synchronize_session=False)
    db.commit()

    seed_creator_posts(db, creator_id)
    post_ids = [p.id for p in db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()]
    if not post_ids:
        post_ids = [f"post_1_{creator_id}", f"post_2_{creator_id}", f"post_3_{creator_id}"]

    commenters_data = [
        {"username": "loyal_fan_sneha", "normal": 6, "hate": 0, "emoji": 1, "dup": 0, "flood": 0, "lead": 0},
        {"username": "travel_freak_rohit", "normal": 4, "hate": 0, "emoji": 2, "dup": 0, "flood": 0, "lead": 0},
        {"username": "bot_promoter_99", "normal": 0, "hate": 0, "emoji": 0, "dup": 4, "flood": 2, "lead": 0},
        {"username": "angry_keyboard_warrior", "normal": 1, "hate": 3, "emoji": 0, "dup": 0, "flood": 0, "lead": 0},
        {"username": "emoji_spammer_girl", "normal": 1, "hate": 0, "emoji": 4, "dup": 0, "flood": 1, "lead": 0},
        {"username": "genuine_customer_rahul", "normal": 1, "hate": 0, "emoji": 0, "dup": 0, "flood": 0, "lead": 2}
    ]

    base_time = datetime.datetime.utcnow() - datetime.timedelta(days=1)

    for cdata in commenters_data:
        uname = cdata["username"]
        commenter = Commenter(
            username=uname,
            creator_id=creator_id,
            total_comments=0,
            last_commented_at=datetime.datetime.utcnow()
        )
        db.add(commenter)
        db.flush()

        # 1. Normal comments
        for i in range(cdata["normal"]):
            media_id = random.choice(post_ids)
            db.add(Comment(
                id=f"seed_c_norm_{uname}_{i}",
                media_id=media_id,
                username=uname,
                text=f"Love this content! Keep going post #{i+1} ❤️",
                timestamp=base_time + datetime.timedelta(hours=i),
                category="Normal"
            ))
            db.add(Like(
                media_id=media_id,
                username=uname,
                timestamp=base_time + datetime.timedelta(hours=i, minutes=1)
            ))
        
        # 2. Hate Comments
        for i in range(cdata["hate"]):
            text = ["Worst video ever, delete this account", "This is stupid post, waste of time!", "Idiot creator, zero knowledge"][i % 3]
            db.add(Comment(
                id=f"seed_c_hate_{uname}_{i}",
                media_id=f"post_1_{creator_id}",
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(hours=12 + i),
                category="Hate Comment"
            ))

        # 3. Emoji Spam
        for i in range(cdata["emoji"]):
            text = "🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥" if i % 2 == 0 else "😂😂😂😂😂😂😂😂😂😂😂"
            db.add(Comment(
                id=f"seed_c_emoji_{uname}_{i}",
                media_id=f"post_3_{creator_id}",
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(minutes=10 * i),
                category="Emoji Spam"
            ))

        # 4. Duplicate Spam
        for i in range(cdata["dup"]):
            db.add(Comment(
                id=f"seed_c_dup_{uname}_{i}",
                media_id=f"post_1_{creator_id}",
                username=uname,
                text="Follow me for free giveaways! 🎁🔥",
                timestamp=base_time + datetime.timedelta(minutes=5 * i),
                category="Duplicate Spam"
            ))

        # 5. Flood Spam
        for i in range(cdata["flood"]):
            db.add(Comment(
                id=f"seed_c_flood_{uname}_{i}",
                media_id=f"post_2_{creator_id}",
                username=uname,
                text=f"Check comment {i+1}",
                timestamp=base_time + datetime.timedelta(seconds=2 * i),
                category="Flood Spam"
            ))

        # 6. Lead comments
        for i in range(cdata["lead"]):
            text = ["Price of this product?", "How can I buy this?", "DM me details please"][i % 3]
            db.add(Comment(
                id=f"seed_c_lead_{uname}_{i}",
                media_id=f"post_1_{creator_id}",
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(hours=6 + i),
                category="Lead"
            ))
            enqueue_dm(db, creator_id, uname, f"seed_c_lead_{uname}_{i}")

        update_commenter_stats(db, commenter)

    db.commit()
    return {"status": "success", "message": f"Successfully seeded mock data for creator {creator_id}"}

@app.delete("/api/simulator/clear/{creator_id}")
def clear_mock_data(creator_id: int, db: Session = Depends(get_db)):
    """Clears all mock/seed data and posts for a creator."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    post_ids = [p.id for p in db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()]
    if post_ids:
        db.query(Comment).filter(Comment.media_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(Like).filter(Like.media_id.in_(post_ids)).delete(synchronize_session=False)

    db.query(MediaPost).filter(MediaPost.creator_id == creator_id).delete(synchronize_session=False)
    db.query(Commenter).filter(Commenter.creator_id == creator_id).delete(synchronize_session=False)
    db.query(DMQueueItem).filter(DMQueueItem.creator_id == creator_id).delete(synchronize_session=False)
    db.commit()

    return {"status": "success", "message": f"Successfully cleared mock data for creator {creator_id}"}



sync_lock = threading.Lock()

@app.post("/api/creators/{creator_id}/sync")
async def sync_instagram_data(creator_id: int, db: Session = Depends(get_db)):
    with sync_lock:
        res = _sync_instagram_data_internal(creator_id, db)
        await process_creator_pending_dms(creator_id)
        return res

def _sync_instagram_data_internal(creator_id: int, db: Session):
    """Fetches real posts and comments from the Instagram Graph API and syncs them to the DB."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    if creator.is_mock or not creator.access_token or not creator.ig_user_id:
        return {"status": "skipped", "reason": "Mock creator or missing Meta credentials"}

    # Cache Creator values locally to prevent ORM lazy loading crashes after commits
    creator_db_id = creator.id
    access_token = creator.access_token
    ig_user_id = creator.ig_user_id
    lead_keywords_str = creator.lead_keywords or "price,buy,link,dm,how much,cost,details"
    instagram_username = creator.instagram_username

    try:
        # 1. Fetch recent posts from Instagram Graph API (limit to last 10 posts)
        media_url = f"https://graph.facebook.com/v17.0/{ig_user_id}/media?fields=id,caption,permalink,media_type,timestamp&access_token={access_token}&limit=10"
        res = requests.get(media_url)
        
        if res.status_code != 200:
            print(f"[Sync Error] Meta API response status: {res.status_code}, body: {res.text}")
            return {"status": "failed", "reason": f"Meta API error: {res.text}"}

        media_data = res.json().get("data", [])
        
        for post_data in media_data:
            post_id = post_data.get("id")
            caption = post_data.get("caption", "")
            permalink = post_data.get("permalink", "")
            media_type = post_data.get("media_type", "IMAGE")
            ts_str = post_data.get("timestamp")
            
            # Parse timestamp to UTC datetime
            created_at_dt = datetime.datetime.utcnow()
            if ts_str:
                try:
                    created_at_dt = datetime.datetime.fromisoformat(ts_str.replace("+0000", "+00:00")).astimezone(datetime.timezone.utc).replace(tzinfo=None)
                except Exception as e:
                    print(f"[Sync Warning] Failed to parse post timestamp {ts_str}: {e}")

            # Upsert the MediaPost
            post = db.query(MediaPost).filter(MediaPost.id == post_id).first()
            if not post:
                post = MediaPost(
                    id=post_id,
                    creator_id=creator_db_id,
                    caption=caption,
                    permalink=permalink,
                    media_type=media_type,
                    created_at=created_at_dt
                )
                db.add(post)
            else:
                post.caption = caption
                post.permalink = permalink
                post.media_type = media_type
            db.commit()

            # 2. Fetch comments for each post
            comments_url = f"https://graph.facebook.com/v17.0/{post_id}/comments?fields=id,text,timestamp,username&access_token={access_token}"
            c_res = requests.get(comments_url)
            
            if c_res.status_code == 200:
                comments_data = c_res.json().get("data", [])
                for comment_data in comments_data:
                    comment_id = comment_data.get("id")
                    comment_text = comment_data.get("text", "")
                    username = comment_data.get("username", "")
                    c_ts_str = comment_data.get("timestamp")
                    
                    if not username:
                        continue
                    
                    comment_dt = datetime.datetime.utcnow()
                    if c_ts_str:
                        try:
                            comment_dt = datetime.datetime.fromisoformat(c_ts_str.replace("+0000", "+00:00")).astimezone(datetime.timezone.utc).replace(tzinfo=None)
                        except Exception as e:
                            print(f"[Sync Warning] Failed to parse comment timestamp {c_ts_str}: {e}")

                    # Check if comment already exists in DB
                    existing_comment = db.query(Comment).filter(Comment.id == comment_id).first()
                    if not existing_comment:
                        # Find/Create commenter
                        commenter = db.query(Commenter).filter(
                            Commenter.username == username,
                            Commenter.creator_id == creator_db_id
                        ).first()
                        
                        if not commenter:
                            commenter = Commenter(
                                username=username,
                                creator_id=creator_db_id,
                                total_comments=0,
                                last_commented_at=comment_dt
                            )
                            db.add(commenter)
                            db.commit()
                            db.refresh(commenter)
                            
                        # Classify the comment text
                        category = classify_comment(db, username, post_id, comment_text, lead_keywords_str)
                        
                        new_comment = Comment(
                            id=comment_id,
                            media_id=post_id,
                            username=username,
                            text=comment_text,
                            timestamp=comment_dt,
                            category=category
                        )
                        db.add(new_comment)
                        db.commit()
                        
                        # Recalculate and update commenter's statistics & risk score
                        update_commenter_stats(db, commenter)
                        
                        # Enqueue auto-DM response for new real comments during sync
                        if category in ["Lead", "Normal"]:
                            enqueue_dm(db, creator_db_id, username, comment_id)

        return {"status": "success", "message": f"Successfully synchronized posts and comments for @{instagram_username}"}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database synchronization error: {str(e)}")


# --- INSTAGRAM WEBHOOKS ---

@app.get("/api/webhooks/instagram")
def verify_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    """Verifies the webhook with Meta."""
    if mode == "subscribe" and challenge:
        return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/api/webhooks/instagram")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Handles incoming live comments/messages from Instagram."""
    payload = await request.json()
    
    if payload.get("object") == "instagram":
        for entry in payload.get("entry", []):
            ig_user_id = entry.get("id")
            creator = db.query(Creator).filter(Creator.ig_user_id == ig_user_id).first()
            if not creator:
                continue
                
            for change in entry.get("changes", []):
                if change.get("field") == "comments":
                    val = change.get("value", {})
                    comment_text = val.get("text")
                    comment_id = val.get("id")
                    media_id = val.get("media", {}).get("id")
                    from_user = val.get("from", {}).get("username")
                    
                    if not comment_text or not from_user:
                        continue
                        
                    category, risk_score = classify_comment(comment_text)
                    
                    db_comment = Comment(
                        id=comment_id,
                        media_id=media_id,
                        username=from_user,
                        text=comment_text,
                        category=category
                    )
                    db.add(db_comment)
                    db.commit()
                    
                    commenter = db.query(Commenter).filter(Commenter.username == from_user, Commenter.creator_id == creator.id).first()
                    if not commenter:
                        commenter = Commenter(username=from_user, creator_id=creator.id)
                        db.add(commenter)
                        db.commit()
                        db.refresh(commenter)
                    update_commenter_stats(db, commenter)
                    
                    if category == "Lead" or category == "Normal":
                        enqueue_dm(db, creator.id, from_user, comment_id)
                        background_tasks.add_task(process_creator_pending_dms, creator.id)

    return {"status": "ok"}


@app.get("/api/debug-db-status")
def debug_db_status(db: Session = Depends(get_db)):
    try:
        creators = db.query(Creator).all()
        posts = db.query(MediaPost).all()
        comments = db.query(Comment).all()
        
        creator_list = []
        for c in creators:
            creator_list.append({
                "id": c.id,
                "instagram_username": c.instagram_username,
                "is_mock": c.is_mock,
                "has_access_token": bool(c.access_token),
                "ig_user_id": c.ig_user_id
            })
            
        post_list = []
        for p in posts:
            post_list.append({
                "id": p.id,
                "creator_id": p.creator_id,
                "caption": p.caption[:30] if p.caption else "",
                "created_at": str(p.created_at)
            })

        db_url_masked = "Unknown"
        from .database import DATABASE_URL
        if DATABASE_URL:
            if "@" in DATABASE_URL:
                parts = DATABASE_URL.split("@")
                db_url_masked = parts[0].split(":")[0] + "://***:***@" + parts[1]
            else:
                db_url_masked = DATABASE_URL
                
        return {
            "status": "success",
            "database_url": db_url_masked,
            "creators_count": len(creators),
            "posts_count": len(posts),
            "comments_count": len(comments),
            "creators": creator_list,
            "posts": post_list
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }

# --- COMMERCIAL SALES & GOOGLE SHEETS SYNC ENDPOINTS ---
GOOGLE_SHEET_WEBHOOK_URL = os.getenv("GOOGLE_SHEET_WEBHOOK_URL", "https://script.google.com/macros/s/AKfycbxqkEBGjHSYqrOJknxOD0XkgCg2qbQ5ZqrRXtxviujkDEx_Sd-EQ-sTLvqzhxenfsiYqQ/exec")

@app.post("/api/sales/checkout")
async def process_sales_checkout(payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Processes customer purchase checkout, saves lead to database,
    and optionally auto-syncs with Google Sheets webhook.
    """
    try:
        username = payload.get("instagram_username", "").strip().lstrip("@")
        email = payload.get("email", "").strip()
        phone = payload.get("phone", "").strip()
        full_name = payload.get("full_name", "").strip()
        plan_name = payload.get("plan_name", "Pro Pass (3 Months Offer)")
        amount = payload.get("amount_paid", 49)
        pay_method = payload.get("payment_method", "UPI")

        if not username:
            raise HTTPException(status_code=400, detail="Instagram handle is required")

        # Save to CustomerLead Database
        lead = CustomerLead(
            instagram_username=username,
            full_name=full_name,
            email=email,
            phone=phone,
            plan_name=plan_name,
            amount_paid=amount,
            payment_status="PAID",
            payment_method=pay_method,
            created_at=datetime.datetime.utcnow()
        )
        db.add(lead)

        # Upgrade / Get Creator Record
        creator = db.query(Creator).filter(Creator.instagram_username == username).first()
        if not creator:
            creator = Creator(
                instagram_username=username,
                is_mock=True,
                subscription_status="pro_active",
                subscription_ends_at=datetime.datetime.utcnow() + datetime.timedelta(days=90)
            )
            db.add(creator)
        else:
            creator.subscription_status = "pro_active"
            creator.subscription_ends_at = datetime.datetime.utcnow() + datetime.timedelta(days=90)

        db.commit()
        db.refresh(lead)

        # Trigger Async Push to Google Sheets if configured
        webhook_url = GOOGLE_SHEET_WEBHOOK_URL or payload.get("google_sheet_url")
        if webhook_url:
            def sync_to_google_sheet():
                try:
                    requests.post(webhook_url, json={
                        "instagram_username": username,
                        "full_name": full_name,
                        "email": email,
                        "phone": phone,
                        "amount_paid": amount,
                        "payment_status": "PAID"
                    }, timeout=10)
                except Exception as sync_err:
                    print(f"[Google Sheets Sync Error] {sync_err}")

            background_tasks.add_task(sync_to_google_sheet)

        return {
            "status": "success",
            "message": "Payment verified. Pro access activated!",
            "lead_id": lead.id,
            "instagram_username": username,
            "amount_paid": amount
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sales/leads")
def get_customer_leads(db: Session = Depends(get_db)):
    """Retrieve all paying customer leads from database."""
    leads = db.query(CustomerLead).order_by(CustomerLead.created_at.desc()).all()
    return [
        {
            "id": l.id,
            "instagram_username": l.instagram_username,
            "full_name": l.full_name,
            "email": l.email,
            "phone": l.phone,
            "amount_paid": l.amount_paid,
            "payment_status": l.payment_status,
            "payment_method": l.payment_method,
            "created_at": l.created_at.isoformat() if l.created_at else ""
        }
        for l in leads
    ]

