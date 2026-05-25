"""Platform-level settings stored in DB (secrets masked on read)."""

from datetime import datetime
from sqlalchemy import String, Boolean, Text, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PlatformSetting(Base):
    """Key-value store for global platform configuration.

    Secrets are flagged via is_secret; the API masks them as '***' on GET.
    Values are stored in plaintext — add Fernet encryption if required.
    """

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now()
    )
