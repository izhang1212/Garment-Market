from app.config import settings
from app.db.session import engine
from app.db.base import Base
from app.models import Item, Transaction, Listing

def main() -> None:
    Base.metadata.create_all(bind=engine)
    print(f"{settings.app_name} database initialized")

if __name__ == "__main__":
    main()