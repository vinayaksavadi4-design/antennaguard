from datetime import datetime
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    metal_area: float = Field(gt=0, le=10000)
    gate_area: float = Field(gt=0, le=10000)
    wire_length: float = Field(gt=0, le=100000)
    layer_count: int = Field(gt=0, le=50)
    metal_width: float = Field(gt=0, le=100)
    spacing: float = Field(gt=0, le=100)


class PredictionResponse(PredictionRequest):
    id: int | None = None
    probability: float
    violation: bool
    severity: str
    recommendation: str
    # Diagnostic fields are computed at inference time and intentionally not persisted
    # as if they were immutable properties of a historical prediction.
    tree_vote_agreement: float | None = None
    input_indicators: list[str] = Field(default_factory=list)
    out_of_training_range: list[str] = Field(default_factory=list)
    model_scope_note: str = "Synthetic demonstration model; not a foundry DRC verdict."
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class BatchPredictionResponse(BaseModel):
    count: int
    items: list[PredictionResponse]


class PredictionStats(BaseModel):
    total: int
    high: int
    medium: int
    low: int
    average_probability: float
