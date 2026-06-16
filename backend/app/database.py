from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite Database URL
import os
if "/var/task" in os.path.abspath(__file__) or os.getenv("VERCEL") == "1" or os.getenv("VERCEL_ENV") is not None:
    DATABASE_URL = "sqlite:////tmp/instagram_spam_moderator.db"
else:
    DATABASE_URL = "sqlite:///./instagram_spam_moderator.db"

# Create Database Engine
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
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
