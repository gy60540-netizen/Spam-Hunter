import json
import asyncio
import datetime
import random
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from .database import engine, Base, get_db
from .models import Creator, MediaPost, Commenter, Comment, DMQueueItem, Like
from .schemas import (
    CreatorResponse, CreatorUpdateTemplates, CreatorUpdateLeadKeywords,
    CreatorToggleMode, MediaPostResponse, CommenterResponse, CommentResponse,
    CommentCreateMock, DMQueueItemResponse, DashboardStats, TopSpammer, TopHater,
    LoyalFanResponse, LikeCreateMock, LikeResponse
)
from .classification import classify_comment, update_commenter_stats
from .queue_worker import run_dm_queue_worker, enqueue_dm

# Initialize DB Tables on startup
Base.metadata.create_all(bind=engine)

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTH ROUTES ---

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

@app.get("/api/posts/{creator_id}", response_model=List[MediaPostResponse])
def get_posts(creator_id: int, db: Session = Depends(get_db)):
    return db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()

@app.get("/api/posts/{media_id}/comments", response_model=List[CommentResponse])
def get_post_comments(media_id: str, db: Session = Depends(get_db)):
    """Returns all comments on a specific post sorted by timestamp desc."""
    return db.query(Comment).filter(Comment.media_id == media_id).order_by(Comment.timestamp.desc()).all()

# --- ANALYTICS DASHBOARD ---

@app.get("/api/analytics/{creator_id}", response_model=DashboardStats)
def get_dashboard_analytics(creator_id: int, db: Session = Depends(get_db)):
    """Computes all dashboard overview statistics."""
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
    return db.query(Commenter).filter(Commenter.creator_id == creator_id).order_by(Commenter.risk_score.desc()).all()

@app.get("/api/commenter/{username}/history", response_model=List[CommentResponse])
def get_commenter_history(username: str, db: Session = Depends(get_db)):
    return db.query(Comment).filter(Comment.username == username).order_by(Comment.timestamp.desc()).all()

# --- DM QUEUE ---

@app.get("/api/queue/{creator_id}", response_model=List[DMQueueItemResponse])
def get_dm_queue(creator_id: int, db: Session = Depends(get_db)):
    return db.query(DMQueueItem).filter(
        DMQueueItem.creator_id == creator_id
    ).order_by(DMQueueItem.scheduled_for.desc()).all()

# --- LOYALTY FANS ROUTES ---

@app.get("/api/loyalty/{creator_id}", response_model=List[LoyalFanResponse])
def get_loyal_fans(creator_id: int, db: Session = Depends(get_db)):
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


# --- SIMULATOR & SEEDING ---

@app.post("/api/simulator/comment", response_model=CommentResponse)
def simulate_new_comment(payload: CommentCreateMock, db: Session = Depends(get_db)):
    """Simulates receiving a new comment on a creator's post."""
    post = db.query(MediaPost).filter(MediaPost.id == payload.media_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Media Post not found")

    creator = db.query(Creator).filter(Creator.id == post.creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

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

    # Auto-DM logic for all comments except Hate Comments and toxic commenters (risk_score > 30)
    if category != "Hate Comment" and commenter.risk_score <= 30:
        enqueue_dm(db, post.creator_id, username, comment_id)

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
    """Seeds a rich set of spammers, hater comments, leads, and normal comments."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    post_ids = [p.id for p in db.query(MediaPost).filter(MediaPost.creator_id == creator_id).all()]
    db.query(Comment).filter(Comment.media_id.in_(post_ids)).delete(synchronize_session=False)
    db.query(Like).filter(Like.media_id.in_(post_ids)).delete(synchronize_session=False)
    db.query(Commenter).filter(Commenter.creator_id == creator_id).delete(synchronize_session=False)
    db.query(DMQueueItem).filter(DMQueueItem.creator_id == creator_id).delete(synchronize_session=False)
    db.commit()

    seed_creator_posts(db, creator_id)

    commenters_data = [
        {"username": "loyal_fan_sneha", "normal": 10, "hate": 0, "emoji": 1, "dup": 0, "flood": 0, "lead": 0},
        {"username": "travel_freak_rohit", "normal": 6, "hate": 0, "emoji": 2, "dup": 0, "flood": 0, "lead": 0},
        {"username": "bot_promoter_99", "normal": 0, "hate": 0, "emoji": 0, "dup": 8, "flood": 3, "lead": 0},
        {"username": "angry_keyboard_warrior", "normal": 1, "hate": 4, "emoji": 0, "dup": 0, "flood": 0, "lead": 0},
        {"username": "emoji_spammer_girl", "normal": 2, "hate": 0, "emoji": 6, "dup": 0, "flood": 1, "lead": 0},
        {"username": "genuine_customer_rahul", "normal": 1, "hate": 0, "emoji": 0, "dup": 0, "flood": 0, "lead": 3}
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
        db.commit()
        db.refresh(commenter)

        # 1. Normal comments
        for i in range(cdata["normal"]):
            text = f"Love this content! Keep going post #{i+1} ❤️"
            media_id = random.choice(post_ids)
            c = Comment(
                id=f"seed_c_norm_{uname}_{i}",
                media_id=media_id,
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(hours=i),
                category="Normal"
            )
            db.add(c)
            l = Like(
                media_id=media_id,
                username=uname,
                timestamp=base_time + datetime.timedelta(hours=i, minutes=1)
            )
            db.add(l)
        
        # 2. Hate Comments
        for i in range(cdata["hate"]):
            text = ["Worst video ever, delete this account", "This is stupid post, waste of time!", "Idiot creator, zero knowledge", "Bakwas content, unfollowed"][i % 4]
            c = Comment(
                id=f"seed_c_hate_{uname}_{i}",
                media_id=f"post_1_{creator_id}",
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(hours=12 + i),
                category="Hate Comment"
            )
            db.add(c)

        # 3. Emoji Spam
        for i in range(cdata["emoji"]):
            text = "🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥" if i % 2 == 0 else "😂😂😂😂😂😂😂😂😂😂😂"
            c = Comment(
                id=f"seed_c_emoji_{uname}_{i}",
                media_id=f"post_3_{creator_id}",
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(minutes=10 * i),
                category="Emoji Spam"
            )
            db.add(c)

        # 4. Duplicate Spam
        for i in range(cdata["dup"]):
            c = Comment(
                id=f"seed_c_dup_{uname}_{i}",
                media_id=f"post_1_{creator_id}",
                username=uname,
                text="Follow me for free giveaways! 🎁🔥",
                timestamp=base_time + datetime.timedelta(minutes=5 * i),
                category="Duplicate Spam"
            )
            db.add(c)

        # 5. Flood Spam
        for i in range(cdata["flood"]):
            c = Comment(
                id=f"seed_c_flood_{uname}_{i}",
                media_id=f"post_2_{creator_id}",
                username=uname,
                text=f"Check comment {i+1}",
                timestamp=base_time + datetime.timedelta(seconds=2 * i),
                category="Flood Spam"
            )
            db.add(c)

        # 6. Lead comments
        for i in range(cdata["lead"]):
            text = ["Price of this product?", "How can I buy this?", "DM me details please"][i % 3]
            c = Comment(
                id=f"seed_c_lead_{uname}_{i}",
                media_id=f"post_1_{creator_id}",
                username=uname,
                text=text,
                timestamp=base_time + datetime.timedelta(hours=6 + i),
                category="Lead"
            )
            db.add(c)

        db.commit()
        update_commenter_stats(db, commenter)

    return {"status": "success", "message": f"Successfully seeded mock data for creator {creator_id}"}
