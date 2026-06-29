from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect as sa_inspect

from app.db.base import Base
from app.db.session import engine
from app.config import settings


def _startup() -> None:
    Base.metadata.create_all(bind=engine)

    # Add image_url column to items if it doesn't exist yet (one-time migration).
    try:
        inspector = sa_inspect(engine)
        cols = [c["name"] for c in inspector.get_columns("items")]
        if "image_url" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE items ADD COLUMN image_url TEXT"))
                conn.commit()
    except Exception:
        pass

    if settings.kicks_db_api_key:
        from app.data.seed_data import seed_items_only
        from app.data.kicks_db import KicksDBClient, load_all_items

        print("KicksDB API key detected — loading real market data.\n")
        seed_items_only()
        client = KicksDBClient(settings.kicks_db_api_key)
        load_all_items(client)
    else:
        from app.data.seed_data import seed_database

        print("No KICKS_DB_API_KEY set — using seed data.\n")
        seed_database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _startup()
    yield


app = FastAPI(title="Garment Market API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes.items import router as items_router
from api.routes.search import router as search_router

app.include_router(items_router, prefix="/api")
app.include_router(search_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
