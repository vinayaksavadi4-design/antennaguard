from pydantic import BaseModel, Field, model_validator
from app.schemas.prediction import PredictionRequest
from typing import Literal


class EDAVerificationRequest(BaseModel):
    prediction_id: int | None = Field(default=None, gt=0)
    verified_features: PredictionRequest | None = None
    design_name: str = Field(min_length=1, max_length=200)
    net_name: str | None = Field(default=None, max_length=300)
    technology: str = Field(min_length=1, max_length=200)
    rule_deck: str = Field(min_length=1, max_length=300)
    source_tool: str = Field(min_length=1, max_length=120)
    result: Literal["PASS", "FAIL", "INCONCLUSIVE"]
    violation_count: int = Field(default=0, ge=0, le=10000000)
    notes: str | None = Field(default=None, max_length=5000)
    correction_action: str | None = Field(default=None, max_length=3000)
    report_reference: str | None = Field(default=None, max_length=500)
    report_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")

    @model_validator(mode="after")
    def validate_result_count(self):
        if self.result == "PASS" and self.violation_count != 0:
            raise ValueError("A PASS result must have violation_count=0")
        if self.result == "FAIL" and self.violation_count < 1:
            raise ValueError("A FAIL result must have violation_count>=1")
        return self
