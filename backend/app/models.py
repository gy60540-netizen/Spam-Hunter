import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

class Creator(Base):
    __tablename__ = "creators"

    id = Column(Integer, primary_key=True, index=True)
    instagram_username = Column(String, unique=True, index=True)
    access_token = Column(String, nullable=True)
    dm_templates = Column(Text, default="[]")  # JSON list of strings
    lead_keywords = Column(Text, default="price,buy,link,dm,how much,cost,details,purchase,collaborate,want,need,interested,me,info,kitne ka hai,kahan,online,review,code,genuine")
    lead_dm_templates = Column(Text, default="[]") # JSON list of strings
    is_mock = Column(Boolean, default=True)
    subscription_status = Column(String, default="active")
    subscription_ends_at = Column(DateTime, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    razorpay_customer_id = Column(String, nullable=True)
    razorpay_subscription_id = Column(String, nullable=True)
    
    # Meta / Instagram Live Integration Fields
    fb_page_id = Column(String, nullable=True)
    fb_page_access_token = Column(String, nullable=True)
    ig_user_id = Column(String, nullable=True)
    long_lived_token = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    posts = relationship("MediaPost", back_populates="creator", cascade="all, delete-orphan")
    commenters = relationship("Commenter", back_populates="creator", cascade="all, delete-orphan")
    queue_items = relationship("DMQueueItem", back_populates="creator", cascade="all, delete-orphan")

class MediaPost(Base):
    __tablename__ = "media_posts"

    id = Column(String, primary_key=True, index=True)  # Instagram Media ID
    creator_id = Column(Integer, ForeignKey("creators.id"))
    caption = Column(Text, nullable=True)
    permalink = Column(String, nullable=True)
    media_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    creator = relationship("Creator", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")

class Commenter(Base):
    __tablename__ = "commenters"
    # Ensure username is unique *per creator*
    __table_args__ = (UniqueConstraint('username', 'creator_id', name='_username_creator_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)  # Commenter's Instagram handle
    creator_id = Column(Integer, ForeignKey("creators.id"))
    total_comments = Column(Integer, default=0)
    flood_spam_count = Column(Integer, default=0)
    duplicate_spam_count = Column(Integer, default=0)
    emoji_spam_count = Column(Integer, default=0)
    hate_comment_count = Column(Integer, default=0)
    risk_score = Column(Integer, default=0)  # 0 to 100 based on toxicity/spam ratios
    last_commented_at = Column(DateTime, default=datetime.datetime.utcnow)

    creator = relationship("Creator", back_populates="commenters")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, index=True)  # Instagram Comment ID
    media_id = Column(String, ForeignKey("media_posts.id"))
    username = Column(String, index=True)
    text = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    category = Column(String, default="Normal")  # Normal, Flood Spam, Duplicate Spam, Emoji Spam, Hate Comment

    post = relationship("MediaPost", back_populates="comments")

class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(String, ForeignKey("media_posts.id"))
    username = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    post = relationship("MediaPost", back_populates="likes")

class DMQueueItem(Base):
    __tablename__ = "dm_queue"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("creators.id"))
    recipient_username = Column(String)
    comment_id = Column(String)
    message_text = Column(Text)
    status = Column(String, default="PENDING")  # PENDING, SENT, FAILED
    scheduled_for = Column(DateTime)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    creator = relationship("Creator", back_populates="queue_items")
