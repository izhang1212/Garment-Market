from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Item(Base):
    __tablename__ = "items"

    # item id
    id: Mapped[int] = mapped_column(primary_key=True)
    # item 
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # item name ("Box Logo Shirt")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # item brand ("Supreme", "Stussy")
    brand: Mapped[str] = mapped_column(String(50), nullable=False)
    # item category ("Appearl", "Sneaker", "Accessories")
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    # item size (XS, S, M, L, XL, ...)
    size: Mapped[str] = mapped_column(String(20), nullable=False)

    transactions = relationship("Transaction", back_populates="item", cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="item", cascade="all, delete-orphan")