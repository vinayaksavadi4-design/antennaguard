import csv
import io
from typing import Annotated
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.ml.model import FEATURES, load_or_train, predict, prediction_diagnostics
from app.models import Prediction, User
from app.schemas.prediction import BatchPredictionResponse, PredictionRequest, PredictionResponse, PredictionStats
from pydantic import BaseModel
from app.services.recommendations import make_recommendation

router = APIRouter(prefix="/predictions", tags=["Predictions"])


class CompareRequest(BaseModel):
    baseline: PredictionRequest
    revised: PredictionRequest
settings = get_settings()
model_package = load_or_train(settings.model_path)


def run_one(payload: PredictionRequest):
    values = payload.model_dump()
    violation, probability = predict(model_package, values)
    severity, recommendation = make_recommendation(values, probability)
    return violation, probability, severity, recommendation


def save_result(db: Session, user_id: int, payload: PredictionRequest) -> Prediction:
    violation, probability, severity, recommendation = run_one(payload)
    row = Prediction(
        user_id=user_id,
        **payload.model_dump(),
        probability=round(probability, 6),
        violation=violation,
        severity=severity,
        recommendation=recommendation,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def build_response(values: dict, violation: bool, probability: float, severity: str,
                   recommendation: str, row_id=None, created_at=None) -> PredictionResponse:
    diagnostics = prediction_diagnostics(model_package, values, violation)
    return PredictionResponse(
        **values,
        id=row_id,
        created_at=created_at,
        probability=round(float(probability), 6),
        violation=bool(violation),
        severity=severity,
        recommendation=recommendation,
        tree_vote_agreement=diagnostics["tree_vote_agreement"],
        input_indicators=diagnostics["input_indicators"],
        out_of_training_range=diagnostics["out_of_training_range"],
        model_scope_note=("Scores and input indicators come from a synthetic demonstration model. "
                          "Tree-vote agreement is not calibrated confidence and does not prove a foundry violation."),
    )


def response_for_row(row: Prediction) -> PredictionResponse:
    values = {name: getattr(row, name) for name in FEATURES}
    return build_response(values, row.violation, row.probability, row.severity,
                          row.recommendation, row_id=row.id, created_at=row.created_at)


@router.post("/compare")
def compare_predictions(
    payload: CompareRequest,
    user: User = Depends(get_current_user),
):
    """Compare two parameter sets through the same real inference package, without saving either."""
    baseline_values = payload.baseline.model_dump()
    revised_values = payload.revised.model_dump()
    baseline_tuple = run_one(payload.baseline)
    revised_tuple = run_one(payload.revised)
    baseline = build_response(baseline_values, *baseline_tuple)
    revised = build_response(revised_values, *revised_tuple)
    delta = round(float(revised.probability - baseline.probability), 6)
    return {
        "baseline": baseline,
        "revised": revised,
        "probability_delta": delta,
        "percentage_point_delta": round(delta * 100, 2),
        "direction": "lower_model_score" if delta < 0 else "higher_model_score" if delta > 0 else "unchanged_model_score",
        "verification_note": "This compares model outputs only. It does not simulate a physical layout edit or establish DRC compliance.",
    }


@router.post("/preview", response_model=PredictionResponse)
def preview_prediction(
    payload: PredictionRequest,
    user: User = Depends(get_current_user),
):
    """Compute a live preview without writing a history row for every form edit."""
    violation, probability, severity, recommendation = run_one(payload)
    return build_response(payload.model_dump(), violation, probability, severity, recommendation)


@router.post("/predict", response_model=PredictionResponse)
def predict_one(
    payload: PredictionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = save_result(db, user.id, payload)
    return response_for_row(row)


@router.get("/history", response_model=list[PredictionResponse])
def history(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    rows = (
        db.query(Prediction)
        .filter(Prediction.user_id == user.id)
        .order_by(Prediction.id.desc())
        .limit(limit)
        .all()
    )
    return [response_for_row(row) for row in rows]


@router.get("/stats", response_model=PredictionStats)
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Prediction).filter(Prediction.user_id == user.id).all()
    total = len(rows)
    high = sum(x.severity == "HIGH" for x in rows)
    medium = sum(x.severity == "MEDIUM" for x in rows)
    low = sum(x.severity == "LOW" for x in rows)
    avg = sum(x.probability for x in rows) / total if total else 0.0
    return PredictionStats(total=total, high=high, medium=medium, low=low, average_probability=round(avg, 4))


@router.post("/batch", response_model=BatchPredictionResponse)
async def batch_predict(
    file: Annotated[UploadFile, File(description="CSV with the six model features")],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(status_code=413, detail="CSV is too large. Maximum size is 2 MB")
    try:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ValueError("CSV header is missing")
        missing = [field for field in FEATURES if field not in reader.fieldnames]
        if missing:
            raise ValueError(f"Missing columns: {', '.join(missing)}")
        rows = []
        for row_number, row in enumerate(reader, start=2):
            if row_number > 101:
                raise ValueError("CSV contains more than 100 data rows; maximum is 100")
            try:
                values = {feature: float(row[feature]) for feature in FEATURES}
                layer_count = values["layer_count"]
                if not layer_count.is_integer():
                    raise ValueError("layer_count must be a whole number")
                values["layer_count"] = int(layer_count)
                rows.append(PredictionRequest(**values))
            except Exception as exc:
                raise ValueError(f"row {row_number}: {exc}")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV encoding: {exc}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no data rows")
    saved = [save_result(db, user.id, payload) for payload in rows]
    return BatchPredictionResponse(count=len(saved), items=[response_for_row(row) for row in saved])
