from app.config import settings
from app.db.session import engine
from app.db.base import Base
from app.models import Item, Transaction, Listing


def main() -> None:
    Base.metadata.create_all(bind=engine)
    seed_database()
    print(f"{settings.app_name} ready")

if __name__ == "__main__":
    main()