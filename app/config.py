import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    def __init__(self) -> None:
        self.app_name = os.getenv("APP_NAME", "Garment Market")
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./app/data/processed/fashion_market.db")
        self.kicks_db_api_key = os.getenv("KICKS_DB_API_KEY", "")

        # Comma-separated list of allowed CORS origins.
        # In dev: set ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
        # In prod: set ALLOWED_ORIGINS=https://your-app.vercel.app
        raw_origins = os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://localhost:3000",
        )
        self.allowed_origins: list[str] = [o.strip() for o in raw_origins.split(",") if o.strip()]

settings = Settings()
