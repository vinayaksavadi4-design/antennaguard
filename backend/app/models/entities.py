from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    metal_area: Mapped[float] = mapped_column(Float, nullable=False)
    gate_area: Mapped[float] = mapped_column(Float, nullable=False)
    wire_length: Mapped[float] = mapped_column(Float, nullable=False)
    layer_count: Mapped[int] = mapped_column(Integer, nullable=False)
    metal_width: Mapped[float] = mapped_column(Float, nullable=False)
    spacing: Mapped[float] = mapped_column(Float, nullable=False)
    probability: Mapped[float] = mapped_column(Float, nullable=False)
    violation: Mapped[bool] = mapped_column(Boolean, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user: Mapped[User] = relationship(back_populates="predictions")


class EDADataRecord(Base):
    """Per-net normalized EDA feature row, optionally labeled by actual verification."""
    __tablename__ = "eda_data_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    metal_area: Mapped[float] = mapped_column(Float, nullable=False)
    gate_area: Mapped[float] = mapped_column(Float, nullable=False)
    wire_length: Mapped[float] = mapped_column(Float, nullable=False)
    layer_count: Mapped[int] = mapped_column(Integer, nullable=False)
    metal_width: Mapped[float] = mapped_column(Float, nullable=False)
    spacing: Mapped[float] = mapped_column(Float, nullable=False)
    verified_violation: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    design_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    net_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    technology: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rule_deck: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source_tool: Mapped[str] = mapped_column(String(120), default="Generic EDA import", nullable=False)
    source_file: Mapped[str] = mapped_column(String(255), nullable=False)
    source_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EDAVerification(Base):
    """User-recorded actual antenna-checker result, independent of ML predictions."""
    __tablename__ = "eda_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    prediction_id: Mapped[int | None] = mapped_column(ForeignKey("predictions.id", ondelete="SET NULL"), index=True, nullable=True)
    design_name: Mapped[str] = mapped_column(String(200), nullable=False)
    net_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    technology: Mapped[str] = mapped_column(String(200), nullable=False)
    rule_deck: Mapped[str] = mapped_column(String(300), nullable=False)
    source_tool: Mapped[str] = mapped_column(String(120), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # PASS, FAIL, INCONCLUSIVE
    violation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    correction_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_features_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    report_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
