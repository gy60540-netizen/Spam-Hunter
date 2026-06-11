import re
import datetime
from sqlalchemy.orm import Session
from .models import Comment, Commenter

# Regex to detect standard emojis
EMOJI_PATTERN = re.compile(
    r"["
    r"\U0001f600-\U0001f64f"  # emoticons
    r"\U0001f300-\U0001f5ff"  # symbols & pictographs
    r"\U0001f680-\U0001f6ff"  # transport & map symbols
    r"\U0001f1e0-\U0001f1ff"  # flags
    r"\U00002700-\U000027bf"  # dingbats
    r"\U0001f900-\U0001f9ff"  # supplemental symbols
    r"\U00002600-\U000026ff"  # misc symbols
    r"]+",
    flags=re.UNICODE
)

# Predefined dictionary for Hate / Abusive content (English & Hinglish)
TOXIC_KEYWORDS = [
    # Original list
    "stupid", "idiot", "worst", "hate", "ugly", "dumb", "rubbish", "fake", 
    "cheat", "loser", "scam", "scammer", "scumbag", "garbage", "trash", "useless",
    "bakwas", "chutiya", "pagal", "madarchod", "bhenchod", "kutta", "kamina", 
    "saala", "chor", "fraud", "ghatiya", "faltu", "harami", "gandu", "kamini",
    "badtameez", "bhak", "lodu",
    
    # Newly requested English keywords
    "hatred", "disgusting", "vile", "moron", "pathetic", "worthless", "clown", 
    "fool", "creep", "freak", "psycho", "sick", "toxic", "annoying", "cringe", 
    "liar", "cheater", "coward", "garbagehuman", "trashhuman", "horrible", 
    "terrible", "awful", "disgustingperson", "losermentality", "failure", 
    "attentionseeker", "brainless", "shameless", "nonsense", "shutup", "getlost", 
    "dropdead", "goaway", "nobodylikesyou", "irrelevant", "overrated", 
    "cancelhim", "cancelher", "boycott", "blacklist", "disgrace", "embarrassment", 
    "joke", "ridiculous", "hateyou", "despise", "loathe", "corrupt", "evil", 
    "monster", "snake", "backstabber", "manipulator", "parasite", "bully", 
    "hypocrite", "clownshow", "filthy", "trashcontent", "toxicperson",
    
    # Newly requested Hinglish/Hindi keywords
    "bewakoof", "gadha", "chutiyapa", "nalayak", "nikamma", "lafanga", "bekaar", 
    "gandagi", "bhosdiwala", "kutte", "suar", "suwar", "lund", "randi", "chapri", 
    "jahil", "andhbhakt", "chamcha", "dogla", "dhokebaaz", "makkar", "jhootha", 
    "nalla", "nalli", "nalayakinsaan", "bakchod", "bakchodi", "faltulog", 
    "chutiyagiri", "bakwaascontent", "ghatiyacreator", "nikammaperson", 
    "pagalinsaan", "dimagkharab", "akalnahi", "besharam", "bewajah", "faltugyaan", 
    "dramaqueen", "gandafellow", "tatti", "tatti_content", "kachra", 
    "kachracontent", "beizzati", "zaleel", "zaleelinsaan", "aukatnahi", 
    "aukatdikhao", "muhbandkar", "chupkar", "nikalja", "bhaagja", "nafrat", 
    "nafrati", "zehar", "zehri", "toxicaadmi"
]

def count_emojis(text: str) -> int:
    """Counts total emojis in a string."""
    matches = EMOJI_PATTERN.findall(text)
    return sum(len(m) for m in matches)

def classify_comment(db: Session, username: str, media_id: str, text: str, lead_keywords_str: str = "price,buy,link,dm,how much,cost,details") -> str:
    """
    Classifies a comment into one of:
    - Hate Comment
    - Flood Spam
    - Duplicate Spam
    - Emoji Spam
    - Lead
    - Normal
    """
    cleaned_text = text.strip().lower()

    # 1. Check Hate Comment
    for word in TOXIC_KEYWORDS:
        pattern = r"\b" + re.escape(word) + r"\b"
        if re.search(pattern, cleaned_text):
            return "Hate Comment"

    # 2. Check Emoji Spam
    total_emoji_chars = count_emojis(text)
    if total_emoji_chars > 5:
        return "Emoji Spam"
    if len(text.strip()) > 0 and (total_emoji_chars / len(text.strip())) > 0.7:
        return "Emoji Spam"

    # 3. Check Duplicate Spam
    duplicate_count = db.query(Comment).filter(
        Comment.username == username,
        Comment.text == text
    ).count()
    if duplicate_count >= 1:
        return "Duplicate Spam"

    # 4. Check Flood Spam
    time_limit = datetime.datetime.utcnow() - datetime.timedelta(seconds=30)
    recent_comments_count = db.query(Comment).filter(
        Comment.username == username,
        Comment.media_id == media_id,
        Comment.timestamp >= time_limit
    ).count()

    if recent_comments_count >= 1:
        return "Flood Spam"

    total_on_post = db.query(Comment).filter(
        Comment.username == username,
        Comment.media_id == media_id
    ).count()
    if total_on_post >= 4:
        return "Flood Spam"

    # 5. Check Lead Keywords
    keywords = [k.strip().lower() for k in lead_keywords_str.split(",") if k.strip()]
    for kw in keywords:
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, cleaned_text) or kw in cleaned_text:
            return "Lead"

    return "Normal"

def update_commenter_stats(db: Session, commenter: Commenter):
    """
    Recalculates engagement stats and risk score of a commenter dynamically.
    """
    comments = db.query(Comment).filter(Comment.username == commenter.username).all()
    
    total = len(comments)
    normal = 0
    flood = 0
    duplicate = 0
    emoji = 0
    hate = 0

    for c in comments:
        # Note: both 'Normal' and 'Lead' count as positive engagements for risk calculations
        if c.category in ["Normal", "Lead"]:
            normal += 1
        elif c.category == "Flood Spam":
            flood += 1
        elif c.category == "Duplicate Spam":
            duplicate += 1
        elif c.category == "Emoji Spam":
            emoji += 1
        elif c.category == "Hate Comment":
            hate += 1

    commenter.total_comments = total
    commenter.flood_spam_count = flood
    commenter.duplicate_spam_count = duplicate
    commenter.emoji_spam_count = emoji
    commenter.hate_comment_count = hate

    # Calculate Risk Score
    score = (hate * 50) + (flood * 30) + (duplicate * 25) + (emoji * 15) - (normal * 2)
    commenter.risk_score = max(0, min(100, score))
    
    db.commit()
    db.refresh(commenter)
