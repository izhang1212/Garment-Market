from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    ask_price: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    item = relationship("Item", back_populates="listings")