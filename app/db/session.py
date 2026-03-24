from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# create engine that connects to DB
    # connection to SQLite file
engine = create_engine(settings.database_url, echo=False)

# session factory 
SessionLocal = sessionmaker(bind=engine)

# get session when needed
def get_db():
    return SessionLocal