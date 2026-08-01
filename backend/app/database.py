from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite Database URL or Environment Database URL
import os

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("STORAGE_URL")

if not DATABASE_URL:
    if "/var/task" in os.path.abspath(__file__) or os.getenv("VERCEL") == "1" or os.getenv("VERCEL_ENV") is not None:
        DATABASE_URL = "sqlite:////tmp/instagram_spam_moderator.db"
    else:
        DATABASE_URL = "sqlite:///./instagram_spam_moderator.db"

# Format postgresql scheme and parameters for SQLAlchemy compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if "?pgbouncer=true" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("?pgbouncer=true", "")
if "&pgbouncer=true" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("&pgbouncer=true", "")


# Create Database Engine
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL, connect_args=connect_args
)

# Sessionmaker for DB transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for SQLAlchemy Models
Base = declarative_base()

# Dependency to get DB session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
