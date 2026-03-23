import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    def __init__(self) -> None:
        self.app_name = os.getenv("APP_NAME", "Fashion Market")
        self.debug = os.getenv("DEBUG", "true").lower() == "true"
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./fashion_market.db")

settings = Settings()