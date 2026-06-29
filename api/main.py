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


def _prefetch_images(client) -> None:
    """Quick pass: fetch image URLs for items that don't have one yet.

    Only does a search call per item (no sales fetching), so all images
    are populated in ~5 seconds instead of after the full 1-2 min load.
    """
    from app.data.kicks_db import stockx as sx_pipeline
    from app.db.session import SessionLocal
    from app.schemas import Item

    db = SessionLocal()
    try:
        items = db.query(Item).filter(Item.image_url.is_(None)).all()
        for item in items:
            try:
                sx = sx_pipeline.search_product(client, item.sku)
                if sx:
                    img = (sx.get("image") or sx.get("thumbnail")
                           or sx.get("imageUrl") or sx.get("image_url"))
                    if img:
                        item.image_url = img
            except Exception:
                pass
        db.commit()
        print(f"Background: images pre-fetched for {len(items)} items.")
    except Exception as exc:
        db.rollback()
        print(f"Background: image pre-fetch failed — {exc}")
    finally:
        db.close()


def _load_kicks_db_data() -> None:
    """Runs in a background thread after the server is already up."""
    try:
        from app.data.kicks_db import KicksDBClient, load_all_items
        client = KicksDBClient(settings.kicks_db_api_key)
        # Images first (~5s) so the UI isn't blank while the full load runs
        _prefetch_images(client)
        print("Background: loading KicksDB market data…")
        load_all_items(client)
        print("Background: KicksDB data load complete.")
    except Exception as exc:
        print(f"Background: KicksDB load failed — {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _migrate()

    from app.data.seed_data import seed_database, seed_missing_transactions
    seed_database()
    seed_missing_transactions()  # repairs items that exist but have 0 transactions

    if settings.kicks_db_api_key:
        print("KicksDB API key detected — loading real market data in background.")
        threading.Thread(target=_load_kicks_db_data, daemon=True).start()
    else:
        print("No KICKS_DB_API_KEY — running on seed data.")

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


@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/api/health")
def health():
    return {"status": "ok"}
