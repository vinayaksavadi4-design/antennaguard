from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, eda, predictions
from app.core.config import get_settings
from app.db.session import Base, engine
from app.models import EDADataRecord, EDAVerification, Prediction, User  # noqa: F401
from app.ml.model import load_or_train

settings = get_settings()
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title=settings.app_name,
    version="2.1.0",
    description="AntennaGuard: ML-assisted antenna-rule risk prediction for VLSI physical design.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
model_package = load_or_train(settings.model_path)

app.include_router(auth.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(eda.router, prefix="/api")


@app.get("/api/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": "antennaguard-api",
        "model_ready": True,
        "model_name": model_package.get("meta", {}).get("name", "AntennaGuard model"),
        "model_accuracy": model_package.get("accuracy"),
        "environment": settings.environment,
    }


@app.get("/api/model-info", tags=["System"])
def model_info():
    return {
        "name": model_package.get("meta", {}).get("name"),
        "version": model_package.get("meta", {}).get("version"),
        "data_source": model_package.get("meta", {}).get("data_source", "unknown"),
        "is_foundry_validated": model_package.get("meta", {}).get("is_foundry_validated", False),
        "validation_method": model_package.get("meta", {}).get("evaluation_method", "unknown"),
        "training_samples": model_package.get("meta", {}).get("training_samples"),
        "validation_metrics": model_package.get("metrics", {}),
        "validation_accuracy": model_package.get("accuracy"),
        "feature_importance": model_package.get("feature_importance", {}),
        "training_ranges": {
            "metal_area": [0.5, 120.0], "gate_area": [0.2, 25.0],
            "wire_length": [1.0, 600.0], "layer_count": [1, 8],
            "metal_width": [0.03, 1.2], "spacing": [0.03, 1.0],
        },
        "features": ["metal_area", "gate_area", "wire_length", "layer_count", "metal_width", "spacing"],
        "data_note": "Held-out metrics describe generated synthetic teaching data only. They are not foundry-validated antenna prediction performance.",
        "score_note": "Random Forest class score and tree-vote agreement are uncalibrated indicators, not a probability of silicon or foundry correctness.",
    }


if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{path:path}", include_in_schema=False)
    def spa_fallback(path: str):
        if path.startswith("api/") or path in {"docs", "redoc", "openapi.json"}:
            return JSONResponse({"detail": "Not found"}, status_code=404)
        static_root = STATIC_DIR.resolve()
        candidate = (static_root / path).resolve()
        # Do not serve files outside the built frontend when a crafted path contains ../.
        if candidate.is_relative_to(static_root) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(static_root / "index.html")
