"""Normalized EDA import and actual-verification record endpoints.

Accepted uploads are normalized per-net CSV/JSON records. Raw tool logs do not
usually contain all six model features; join them with extracted feature records
using the documented helper before importing.
"""
import csv
import hashlib
import io
import json
import math
import re
import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.ml.model import FEATURES, load_or_train, predict
from app.models import EDADataRecord, EDAVerification, Prediction, User
from app.schemas.eda import EDAVerificationRequest

router = APIRouter(prefix="/eda", tags=["EDA data and verification"])
MAX_UPLOAD_BYTES = 5_000_000
MAX_ROWS = 5000
settings = get_settings()
model_package = load_or_train(settings.model_path)

# Header aliases normalize common labels from internal EDA feature exports.
ALIASES = {
    "metal_area": {"metalarea", "totalmetalarea", "antennaarea", "conductorarea", "metalareaum2"},
    "gate_area": {"gatearea", "effectivegatearea", "gateareaum2", "connectedgatearea"},
    "wire_length": {"wirelength", "routelength", "wirelengthum", "wirelengthmicrons", "interconnectlength"},
    "layer_count": {"layercount", "numlayers", "routinglayercount", "layers"},
    "metal_width": {"metalwidth", "metalwidthum", "wirewidth", "wirewidthum"},
    "spacing": {"spacing", "minspacing", "minimumspacing", "spacingum", "metalspacing"},
    "verified_violation": {"verifiedviolation", "antenna_violation", "antennaviolation", "edaviolation", "violation", "isviolating", "violated"},
    "design_name": {"design", "designname", "block", "blockname", "circuit"},
    "net_name": {"net", "netname", "signalnet"},
    "technology": {"technology", "technologynode", "pdk", "pdkname", "process"},
    "rule_deck": {"ruledeck", "ruledeckversion", "pdkruledeck", "deck"},
    "source_tool": {"sourcetool", "edatool", "tool", "checker"},
}


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def normalized_record(record: dict) -> dict:
    out = {}
    for key, value in record.items():
        canonical_key = normalize_key(key)
        for canonical, aliases in ALIASES.items():
            if canonical_key == normalize_key(canonical) or canonical_key in {normalize_key(a) for a in aliases}:
                out.setdefault(canonical, value)
                break
        else:
            out[canonical_key] = value
    return out


def parse_boolean_label(value, row_number: int) -> bool | None:
    if value is None or str(value).strip() == "":
        return None
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "fail", "failed", "violation", "violated"}:
        return True
    if normalized in {"0", "false", "no", "n", "pass", "passed", "clean", "none", "no_violation"}:
        return False
    raise ValueError(f"row {row_number}: unrecognized verified_violation value {value!r}; use true/false, 1/0, FAIL/PASS, or leave blank")


def parse_upload(raw: bytes, filename: str) -> list[dict]:
    try:
        decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded CSV or JSON") from exc
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        if suffix == "csv":
            reader = csv.DictReader(io.StringIO(decoded))
            if not reader.fieldnames:
                raise ValueError("CSV header row is missing")
            raw_records = list(reader)
        elif suffix == "json":
            parsed = json.loads(decoded)
            raw_records = parsed.get("records", parsed) if isinstance(parsed, dict) else parsed
            if not isinstance(raw_records, list) or not all(isinstance(row, dict) for row in raw_records):
                raise ValueError("JSON must be a list of row objects or an object with a 'records' list")
        else:
            raise HTTPException(status_code=400, detail="Upload a normalized .csv or .json file")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc.msg}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if len(raw_records) == 0:
        raise HTTPException(status_code=400, detail="File contains no data rows")
    if len(raw_records) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"File has more than {MAX_ROWS} rows")
    return [normalized_record(row) for row in raw_records]


@router.post("/import")
async def import_eda_data(
    file: Annotated[UploadFile, File(description="Normalized per-net CSV or JSON with six feature columns")],
    source_tool: Annotated[str, Form()] = "Generic EDA export",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload a named CSV or JSON file")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="EDA import is limited to 5 MB")
    rows = parse_upload(raw, file.filename)
    file_hash = hashlib.sha256(raw).hexdigest()
    created = []
    errors = []
    for index, row in enumerate(rows, start=2):
        try:
            missing = [feature for feature in FEATURES if row.get(feature) in (None, "")]
            if missing:
                raise ValueError(f"missing feature columns: {', '.join(missing)}")
            values = {name: float(row[name]) for name in FEATURES}
            for name, value in values.items():
                if not math.isfinite(value):
                    raise ValueError(f"{name} must be a finite number")
                if value <= 0:
                    raise ValueError(f"{name} must be greater than zero")
            if not values["layer_count"].is_integer():
                raise ValueError("layer_count must be a whole number")
            values["layer_count"] = int(values["layer_count"])
            # Align with the API's physical-features validation bounds.
            bounds = {"metal_area": 10000, "gate_area": 10000, "wire_length": 100000, "layer_count": 50, "metal_width": 100, "spacing": 100}
            for name, high in bounds.items():
                if values[name] > high:
                    raise ValueError(f"{name} exceeds the accepted API limit {high}")
            label = parse_boolean_label(row.get("verified_violation"), index)
            if label is not None and not row.get("source_file"):
                # The import source is not automatically accepted as foundry ground truth.
                # The user is explicitly choosing a labelled EDA/report export.
                pass
            record = EDADataRecord(
                user_id=user.id,
                **values,
                verified_violation=label,
                design_name=_optional(row.get("design_name"), 200),
                net_name=_optional(row.get("net_name"), 300),
                technology=_optional(row.get("technology"), 200),
                rule_deck=_optional(row.get("rule_deck"), 300),
                source_tool=_optional(row.get("source_tool"), 120) or source_tool[:120],
                source_file=file.filename[:255],
                source_sha256=file_hash,
            )
            created.append(record)
        except (ValueError, TypeError) as exc:
            errors.append(f"row {index}: {exc}")
            if len(errors) >= 10:
                break
    if errors:
        raise HTTPException(status_code=400, detail="Import was not saved because some rows are invalid: " + " | ".join(errors))
    db.add_all(created)
    db.commit()
    return {
        "imported": len(created),
        "labelled_rows": sum(row.verified_violation is not None for row in created),
        "unlabelled_rows": sum(row.verified_violation is None for row in created),
        "source_file": file.filename,
        "sha256": file_hash,
        "note": "Imported rows are kept separate from training. Labels should be treated as ground truth only when derived from a completed, appropriate EDA antenna check and matching rule deck.",
    }


def _optional(value, maximum: int) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    return str(value).strip()[:maximum]


@router.get("/records")
def list_eda_records(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 500))
    rows = db.query(EDADataRecord).filter(EDADataRecord.user_id == user.id).order_by(EDADataRecord.id.desc()).limit(limit).all()
    return [{
        "id": row.id, "design_name": row.design_name, "net_name": row.net_name,
        "technology": row.technology, "rule_deck": row.rule_deck, "source_tool": row.source_tool,
        "source_file": row.source_file, "verified_violation": row.verified_violation,
        "label_status": "verified label" if row.verified_violation is not None else "unlabelled",
        **{name: getattr(row, name) for name in FEATURES}, "created_at": row.created_at,
    } for row in rows]


@router.get("/verifications")
def list_verifications(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 500))
    rows = db.query(EDAVerification).filter(EDAVerification.user_id == user.id).order_by(EDAVerification.id.desc()).limit(limit).all()
    return [{
        "id": row.id, "prediction_id": row.prediction_id, "design_name": row.design_name,
        "net_name": row.net_name, "technology": row.technology, "rule_deck": row.rule_deck,
        "source_tool": row.source_tool, "result": row.result, "violation_count": row.violation_count,
        "notes": row.notes, "correction_action": row.correction_action, "verified_features": row.verified_features_json, "report_reference": row.report_reference, "report_sha256": row.report_sha256,
        "created_at": row.created_at,
    } for row in rows]


@router.post("/verifications")
def create_verification(
    payload: EDAVerificationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prediction = None
    if payload.prediction_id is not None:
        prediction = db.query(Prediction).filter(
            Prediction.id == payload.prediction_id, Prediction.user_id == user.id
        ).first()
        if prediction is None:
            raise HTTPException(status_code=404, detail="Prediction not found in your account")
    verified = EDAVerification(
        user_id=user.id,
        prediction_id=payload.prediction_id,
        design_name=payload.design_name.strip(),
        net_name=payload.net_name.strip() if payload.net_name else None,
        technology=payload.technology.strip(),
        rule_deck=payload.rule_deck.strip(),
        source_tool=payload.source_tool.strip(),
        result=payload.result,
        violation_count=payload.violation_count,
        notes=payload.notes.strip() if payload.notes else None,
        correction_action=payload.correction_action.strip() if payload.correction_action else None,
        verified_features_json=payload.verified_features.model_dump() if payload.verified_features else None,
        report_reference=payload.report_reference.strip() if payload.report_reference else None,
        report_sha256=payload.report_sha256.lower() if payload.report_sha256 else None,
    )
    db.add(verified)
    db.flush()
    # Only label the exact feature vector from the layout that was actually checked.
    # A linked Prediction may represent the pre-correction layout, so never reuse its
    # input features as the post-correction ground truth automatically.
    dataset_record_saved = False
    label = True if payload.result == "FAIL" else False if payload.result == "PASS" else None
    if payload.verified_features is not None and label is not None:
        actual_features = payload.verified_features.model_dump()
        source_payload = f"verification:{verified.id}:{payload.result}:{payload.rule_deck}:{payload.source_tool}"
        source_hash = payload.report_sha256.lower() if payload.report_sha256 else hashlib.sha256(source_payload.encode()).hexdigest()
        db.add(EDADataRecord(
            user_id=user.id,
            **actual_features,
            verified_violation=label,
            design_name=payload.design_name.strip()[:200],
            net_name=payload.net_name.strip()[:300] if payload.net_name else None,
            technology=payload.technology.strip()[:200],
            rule_deck=payload.rule_deck.strip()[:300],
            source_tool=payload.source_tool.strip()[:120],
            source_file=f"verification-{verified.id}",
            source_sha256=source_hash,
        ))
        dataset_record_saved = True
    db.commit()
    db.refresh(verified)
    if dataset_record_saved:
        note = "Actual checker result stored separately from ML output, and the feature snapshot of the layout checked was added as a labelled dataset row."
    elif label is not None:
        note = "Actual checker result stored. No labelled feature row was added: supply the six features from the exact layout that was checked to avoid mislabelling pre-correction inputs."
    else:
        note = "Inconclusive checker result stored but not added to the labelled dataset."
    return {
        "id": verified.id, "prediction_id": verified.prediction_id,
        "result": verified.result, "violation_count": verified.violation_count,
        "design_name": verified.design_name, "correction_action": verified.correction_action, "created_at": verified.created_at,
        "labelled_dataset_row_saved": dataset_record_saved,
        "note": note,
    }


@router.get("/evaluation")
def evaluate_against_verified_records(
    technology: str | None = None,
    rule_deck: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Evaluate model against labelled records, optionally within one technology/rule deck."""
    query = db.query(EDADataRecord).filter(
        EDADataRecord.user_id == user.id,
        EDADataRecord.verified_violation.is_not(None),
    )
    if technology:
        query = query.filter(EDADataRecord.technology == technology)
    if rule_deck:
        query = query.filter(EDADataRecord.rule_deck == rule_deck)
    rows = query.order_by(EDADataRecord.id.asc()).all()
    positives = sum(row.verified_violation is True for row in rows)
    negatives = sum(row.verified_violation is False for row in rows)
    base = {
        "evaluable": False,
        "labelled_samples": len(rows),
        "violation_samples": positives,
        "no_violation_samples": negatives,
        "model_name": model_package.get("meta", {}).get("name"),
        "technology_filter": technology,
        "rule_deck_filter": rule_deck,
        "model_trained_on_eda_records": False,
        "message": "Import labelled records from a completed antenna checker. Both PASS and FAIL outcomes are needed for a meaningful external evaluation.",
    }
    if len(rows) < 2 or positives == 0 or negatives == 0:
        return base
    y_true = np.array([int(row.verified_violation) for row in rows], dtype=int)
    y_pred = []
    y_score = []
    for row in rows:
        values = {name: getattr(row, name) for name in FEATURES}
        predicted, score = predict(model_package, values)
        y_pred.append(int(predicted))
        y_score.append(score)
    matrix = confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist()
    return {
        **base,
        "evaluable": True,
        "message": "External evaluation against user-imported labels. Confirm every label came from the matching completed EDA check and rule deck.",
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 6),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 6),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 6),
        "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 6),
        "roc_auc": round(float(roc_auc_score(y_true, y_score)), 6),
        "confusion_matrix": {"labels": ["no_violation", "violation"], "matrix": matrix,
                             "true_negatives": int(matrix[0][0]), "false_positives": int(matrix[0][1]),
                             "false_negatives": int(matrix[1][0]), "true_positives": int(matrix[1][1])},
        "note": "These metrics apply only to the labelled imported records. They are not an independent benchmark if records overlap model-development data or labels are incomplete.",
    }


@router.get("/verified-dataset.csv")
def export_verified_dataset(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.query(EDADataRecord).filter(
        EDADataRecord.user_id == user.id,
        EDADataRecord.verified_violation.is_not(None),
    ).order_by(EDADataRecord.id.asc()).all()
    output = io.StringIO()
    columns = ["design_name", "net_name", "technology", "rule_deck", "source_tool", *FEATURES, "verified_violation", "source_file", "source_sha256"]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        data = {name: getattr(row, name) for name in columns}
        writer.writerow(data)
    content = output.getvalue()
    return StreamingResponse(
        iter([content]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=antennaguard-verified-eda-dataset.csv"},
    )
