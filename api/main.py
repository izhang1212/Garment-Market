import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect as sa_inspect

from app.db.base import Base
from app.db.session import engine
from app.config import settings


def _migrate() -> None:
    Base.metadata.create_all(bind=engine)
    try:
        inspector = sa_inspect(engine)
        cols = [c["name"] for c in inspector.get_columns("items")]
        if "image_url" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE items ADD COLUMN image_url TEXT"))
                conn.commit()
    except Exception:
        pass


def _load_kicks_db_data() -> None:
    """Runs in a background thread after the server is already up."""
    try:
        from app.data.kicks_db import KicksDBClient, load_all_items
        client = KicksDBClient(settings.kicks_db_api_key)
        print("Background: loading KicksDB market data…")
        load_all_items(client)
        print("Background: KicksDB data load complete.")
    except Exception as exc:
        print(f"Background: KicksDB load failed — {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _migrate()

    if settings.kicks_db_api_key:
        from app.data.seed_data import seed_items_only
        print("KicksDB API key detected — seeding items, then loading market data in background.")
        seed_items_only()
        # Load KicksDB data after the server is up so Render detects the open port immediately
        threading.Thread(target=_load_kicks_db_data, daemon=True).start()
    else:
        from app.data.seed_data import seed_database
        print("No KICKS_DB_API_KEY — using seed data.")
        seed_database()

    yield


app = FastAPI(title="Garment Market API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],   # read-only API — no POST/PUT/DELETE needed
    allow_headers=["*"],
)

from api.routes.items import router as items_router
from api.routes.search import router as search_router

app.include_router(items_router, prefix="/api")
app.include_router(search_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
