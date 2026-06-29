import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# Ensure the directory exists before SQLAlchemy tries to create the SQLite file.
# This matters on Render where app/data/processed/ is gitignored and won't exist.
if settings.database_url.startswith("sqlite:///"):
    db_path = settings.database_url.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

engine = create_engine(settings.database_url, echo=False)

# session factory 
SessionLocal = sessionmaker(bind=engine)

# get session when needed
def get_db():
    return SessionLocal