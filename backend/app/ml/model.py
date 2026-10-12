"""AntennaGuard ML model and auditable synthetic-data evaluation.

The bundled dataset is intentionally synthetic for software development. Metrics
reported here describe a held-out split of that generated dataset only; they are
not estimates of foundry or silicon performance.
"""
from pathlib import Path
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

FEATURES = ["metal_area", "gate_area", "wire_length", "layer_count", "metal_width", "spacing"]
MODEL_META = {
    "name": "AntennaGuard Random Forest",
    "version": "synthetic-v3-evaluation",
    "data_source": "synthetic",
    "is_foundry_validated": False,
}
TRAINING_RANGES = {
    "metal_area": (0.5, 120.0),
    "gate_area": (0.2, 25.0),
    "wire_length": (1.0, 600.0),
    "layer_count": (1.0, 8.0),
    "metal_width": (0.03, 1.2),
    "spacing": (0.03, 1.0),
}


def generate_demo_dataset(seed: int = 42, n: int = 4000):
    """Generate reproducible classroom/demo data, never presented as real EDA data."""
    rng = np.random.default_rng(seed)
    metal_area = rng.uniform(0.5, 120, n)
    gate_area = rng.uniform(0.2, 25, n)
    wire_length = rng.uniform(1, 600, n)
    layer_count = rng.integers(1, 9, n)
    metal_width = rng.uniform(0.03, 1.2, n)
    spacing = rng.uniform(0.03, 1.0, n)
    risk = (
        0.75 * (metal_area / 120.0)
        + 0.65 * (wire_length / 600.0)
        + 0.45 * (layer_count / 8.0)
        + 0.20 * (metal_width / 1.2)
        - 0.45 * (spacing / 1.0)
        - 0.50 * (gate_area / 25.0)
        + rng.normal(0, 0.14, n)
    )
    y = (risk > 0.60).astype(int)
    X = np.column_stack([metal_area, gate_area, wire_length, layer_count, metal_width, spacing])
    return X, y


def evaluate_classifier(model, X_test, y_test) -> dict:
    predicted = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    matrix = confusion_matrix(y_test, predicted, labels=[0, 1]).tolist()
    return {
        "accuracy": round(float(accuracy_score(y_test, predicted)), 6),
        "precision": round(float(precision_score(y_test, predicted, zero_division=0)), 6),
        "recall": round(float(recall_score(y_test, predicted, zero_division=0)), 6),
        "f1_score": round(float(f1_score(y_test, predicted, zero_division=0)), 6),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 6),
        "confusion_matrix": {
            "labels": ["no_violation", "violation"],
            "matrix": matrix,
            "true_negatives": int(matrix[0][0]),
            "false_positives": int(matrix[0][1]),
            "false_negatives": int(matrix[1][0]),
            "true_positives": int(matrix[1][1]),
        },
        "test_samples": int(len(y_test)),
        "test_positive_rate": round(float(np.mean(y_test)), 6),
    }


def train_and_save(path: str) -> dict:
    X, y = generate_demo_dataset()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = RandomForestClassifier(
        n_estimators=240,
        max_depth=12,
        min_samples_leaf=8,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    metrics = evaluate_classifier(model, X_test, y_test)
    feature_importance = {
        name: round(float(score), 6)
        for name, score in sorted(
            zip(FEATURES, model.feature_importances_), key=lambda item: item[1], reverse=True
        )
    }
    package = {
        "model": model,
        "accuracy": metrics["accuracy"],
        "metrics": metrics,
        "feature_importance": feature_importance,
        "meta": {
            **MODEL_META,
            "training_samples": int(len(y_train)),
            "test_samples": int(len(y_test)),
            "evaluation_method": "stratified 80/20 hold-out split; random_state=42",
            "training_data_note": "Deterministically generated synthetic labels; not from a PDK or EDA checker.",
        },
    }
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as handle:
        pickle.dump(package, handle)
    return {"metrics": metrics, "samples": int(len(y)), "feature_importance": feature_importance}


def load_or_train(path: str):
    target = Path(path)
    try:
        if target.exists():
            with target.open("rb") as handle:
                package = pickle.load(handle)
            if (
                isinstance(package, dict)
                and package.get("model") is not None
                and package.get("meta", {}).get("version") == MODEL_META["version"]
                and package.get("metrics")
                and package.get("feature_importance")
            ):
                return package
    except Exception:
        # A stale/corrupt pickle is regenerated so it cannot take the API down.
        pass
    train_and_save(str(target))
    with target.open("rb") as handle:
        return pickle.load(handle)


def predict(package, values: dict) -> tuple[bool, float]:
    model = package["model"]
    X = np.array([[values[name] for name in FEATURES]], dtype=float)
    probability = float(model.predict_proba(X)[0, 1])
    violation = bool(model.predict(X)[0])
    return violation, probability


def prediction_diagnostics(package, values: dict, violation: bool | None = None) -> dict:
    """Return transparent diagnostic indicators, not causal or foundry explanations."""
    model = package["model"]
    X = np.array([[values[name] for name in FEATURES]], dtype=float)
    predicted = bool(model.predict(X)[0]) if violation is None else bool(violation)
    vote_agreement = float(np.mean([bool(tree.predict(X)[0]) == predicted for tree in model.estimators_]))

    importance = package.get("feature_importance") or {
        name: float(score) for name, score in zip(FEATURES, model.feature_importances_)
    }
    # This direction follows the synthetic demonstration label rule only. The wording
    # explicitly avoids implying process-independent physics or causal attribution.
    risk_directions = {
        "metal_area": 1,
        "gate_area": -1,
        "wire_length": 1,
        "layer_count": 1,
        "metal_width": 1,
        "spacing": -1,
    }
    scored = []
    out_of_range = []
    for feature in FEATURES:
        low, high = TRAINING_RANGES[feature]
        value = float(values[feature])
        position = (value - low) / (high - low)
        if value < low or value > high:
            out_of_range.append(feature)
        # Positive score = feature sits on the synthetic training rule's risk-associated side.
        strength = (position - 0.5) * 2 * risk_directions[feature] * float(importance.get(feature, 0.0))
        scored.append((strength, feature, value, position, low, high))
    scored.sort(reverse=True)
    indicators = []
    for strength, feature, value, position, low, high in scored:
        if strength <= 0:
            continue
        side = "upper" if risk_directions[feature] > 0 else "lower"
        indicators.append(
            f"{feature} is toward the {side} end of the model's synthetic training range ({value:g}; range {low:g}–{high:g})."
        )
        if len(indicators) == 3:
            break
    if not indicators:
        indicators = ["No dominant risk-associated input indicator was identified from the synthetic model rule."]
    return {
        "tree_vote_agreement": round(vote_agreement, 4),
        "input_indicators": indicators,
        "out_of_training_range": out_of_range,
    }
