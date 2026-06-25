from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    # price item was transacted at
    price: Mapped[float] = mapped_column(Float, nullable=False)
    # how many items were transacted upon
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # source of the transaction (StockX, ebay)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    # time of the trasaction
    transacted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    item = relationship("Item", back_populates="transactions")