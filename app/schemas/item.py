from typing import Optional
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    brand: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    size: Mapped[str] = mapped_column(String(20), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, default=None)

    transactions = relationship("Transaction", back_populates="item", cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="item", cascade="all, delete-orphan")