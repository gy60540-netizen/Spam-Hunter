from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Creator Schemas
class CreatorBase(BaseModel):
    instagram_username: str
    is_mock: bool

class CreatorCreate(CreatorBase):
    pass

class CreatorResponse(CreatorBase):
    id: int
    dm_templates: str
    lead_keywords: str
    lead_dm_templates: str
    subscription_status: str
    subscription_ends_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class CreatorUpdateTemplates(BaseModel):
    dm_templates: List[str]

class CreatorUpdateLeadKeywords(BaseModel):
    lead_keywords: str

class CreatorToggleMode(BaseModel):
    is_mock: bool

# Media Post Schemas
class MediaPostResponse(BaseModel):
    id: str
    creator_id: int
    caption: Optional[str]
    permalink: Optional[str]
    media_type: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Commenter Schemas
class CommenterResponse(BaseModel):
    username: str
    creator_id: int
    total_comments: int
    flood_spam_count: int
    duplicate_spam_count: int
    emoji_spam_count: int
    hate_comment_count: int
    risk_score: int
    last_commented_at: datetime

    class Config:
        from_attributes = True

# Comment Schemas
class CommentResponse(BaseModel):
    id: str
    media_id: str
    username: str
    text: str
    timestamp: datetime
    category: str

    class Config:
        from_attributes = True

class CommentCreateMock(BaseModel):
    media_id: str
    username: str
    text: str

class LikeCreateMock(BaseModel):
    media_id: str
    username: str

class LikeResponse(BaseModel):
    id: int
    media_id: str
    username: str
    timestamp: datetime

    class Config:
        from_attributes = True

# DM Queue Schemas
class DMQueueItemResponse(BaseModel):
    id: int
    creator_id: int
    recipient_username: str
    comment_id: str
    message_text: str
    status: str
    scheduled_for: datetime
    sent_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True

# Analytics Dashboard Stats Schema
class TopSpammer(BaseModel):
    username: str
    spam_count: int

class TopHater(BaseModel):
    username: str
    hate_count: int

class DashboardStats(BaseModel):
    total_comments: int
    total_users: int
    spam_comments: int
    hate_comments: int
    leads_detected: int
    top_flood_spammers: List[TopSpammer]
    top_hate_commenters: List[TopHater]

# Loyal Fans Schemas
class LoyalFanResponse(BaseModel):
    username: str
    total_comments: int
    risk_score: int
    active_weeks: int
    active_months: int
    loyalty_tier: str

