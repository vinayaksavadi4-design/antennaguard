# AntennaGuard 2.1

A deployable full-stack academic project for ML-assisted prediction of antenna-rule violation risk in VLSI physical design.

## Stack

- Frontend: React 19 + Vite 8 + React Router 7
- Backend: FastAPI + SQLAlchemy
- Authentication: JWT + Argon2 password hashing
- Database: SQLite locally, PostgreSQL in deployment
- ML: scikit-learn Random Forest trained on deterministic synthetic project data
- Deployment: Render blueprint included; Dockerfile included as optional deployment path

Current package pins are intentionally fixed so the same environment is reproducible. scikit-learn 1.9.1 and NumPy 2.3.3 publish Python 3.14 wheels, including Windows x86-64, and Uvicorn 0.53.0 supports Python 3.14. Verify the current release files before changing pins. 

## Local Windows run (no Docker)

### Easiest method

1. Install Python 3.14 and Node.js 22.
2. Double-click `SETUP_WINDOWS.bat`.
3. After setup, double-click `START_WINDOWS.bat`.
4. The browser opens at `http://localhost:5173`.

The scripts use the folder containing the project, so they work even when the project is not on the Desktop.

### Manual method

#### Backend terminal

```powershell
cd "C:\Users\santosh\OneDrive\Desktop\antennaguard-final\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Keep this terminal open.

#### Frontend terminal

Open a second PowerShell:

```powershell
cd "C:\Users\santosh\OneDrive\Desktop\antennaguard-final\frontend"
npm install
npm run dev
```

Open:

- http://localhost:5173
- http://localhost:8000/docs

The Vite development server proxies `/api` to the FastAPI server, so no frontend `.env` file is needed for local use.

## AntennaGuard Pro dashboard pages

The updated React UI incorporates the feature set from `AntennaGuard_Pro_Website.html` while keeping the existing FastAPI API, saved predictions and authentication flow:

- **Dashboard**: API/model status, held-out validation availability, prediction totals, readiness checks and the four-stage screening workflow.
- **Analyze net**: six-feature single-net prediction, live preview, improvement guidance, conceptual layout illustration, and before/after input comparison.
- **Batch import**: authenticated CSV predictions for up to 100 rows and downloadable prediction output.
- **Validation**: model metrics, confusion matrix, feature importance, and model-scope warnings.
- **EDA Verification**: normalized CSV/JSON feature import, traceable labels, and actual checker-result / correction records.
- **History**: per-account prediction archive.
- **Workflow**: input schema, component architecture, local setup and sign-off limitations.

The color scheme now follows the supplied dark AntennaGuard Pro HTML reference. The batch prediction API accepts the six feature columns and saves its prediction rows; it is not an actual DRC parser. Use EDA Verification for source metadata and supplied checker labels.

## First-use flow

1. Create an account.
2. Sign in.
3. Open Prediction Lab.
4. Click **Load demo case** or enter your own features.
5. Wait briefly for the live preview to recalculate as values change.
6. Click **Run & save prediction** to store a confirmed run in history.
7. Review probability, severity and engineering guidance in History/Reports.

## Important research note

The bundled Random Forest model is trained on synthetic data created by `backend/app/ml/model.py`. The synthetic-v2 training labels are normalized to provide a visible range of low/medium/high demo results. It is suitable for demonstrating the software workflow, not for claiming foundry-accurate DRC prediction. Replace the synthetic dataset with validated physical-design/DRC data for research evaluation and final performance numbers.

## New model validation and EDA verification workflow

The upgraded version adds the following without replacing the login or prediction API:

- `GET /api/model-info` returns the held-out synthetic evaluation metrics (accuracy, precision, recall, F1, ROC-AUC and confusion matrix), feature importance, training ranges, and data-scope warnings.
- Prediction responses now include Random Forest tree-vote agreement, input-range warnings and indicative input factors. Vote agreement is **not calibrated confidence**; indicators describe the synthetic model, not a foundry rule explanation.
- `POST /api/predictions/compare` compares baseline and revised inputs using the same prediction package without saving two extra history rows.
- The **EDA Verification** page accepts normalized per-net CSV/JSON imports and records actual checker outcomes linked to a saved prediction and the correction tried. Labelled verification rows require the explicit feature snapshot of the exact layout that was checked, so pre-correction inputs are not silently labelled with post-correction outcomes.
- `GET /api/eda/evaluation` evaluates the current model against imported, labelled EDA records without retraining; optional `technology` and `rule_deck` query parameters let you keep each profile separate. It requires both PASS and FAIL labels for a complete binary evaluation.
- `GET /api/eda/verified-dataset.csv` exports labelled records. They are kept separate from the live model until you choose and validate an appropriate retraining workflow.

Read `docs/EDA_IMPORT_GUIDE.md` for the import schema, data-joining helper, label safeguards and verification workflow. A starter file is provided at `eda_import_template.csv`.

**Limitations:** The bundled model still uses synthetic data. Imported data aren't automatically verified by the application, and the app does not parse arbitrary GDSII/OASIS, execute commercial PDK rule decks, or apply physical routing fixes. Run the actual antenna checker for verification and keep its matching report, technology and rule-deck version.

## Docker Compose (single-container local/VPS setup)

The Compose file requires a secret instead of shipping a known default. Before running it, copy `.env.example` to `.env`, generate a random key with `python -c "import secrets; print(secrets.token_urlsafe(48))"`, and paste that value after `SECRET_KEY=` in `.env`. Then run `docker compose up --build`. Keep `.env` private and out of Git. For a public VPS, put the service behind a TLS reverse proxy rather than exposing plain HTTP directly.

## Deployment

### Render

The repository includes `render.yaml` for a separate backend web service, PostgreSQL database and static frontend. The included blueprint uses `https://antennaguard-web.onrender.com` as the frontend origin and also allows local development. If you rename the Render service, update `CORS_ORIGINS` to the new frontend URL. PostgreSQL URLs from the provider are normalized to SQLAlchemy’s `postgresql+psycopg://` form because this project installs Psycopg 3.

### Vercel + Render

For the frontend, create a Vercel project from `frontend/`, build with `npm run build`, output `dist`, and set `VITE_API_BASE_URL=https://YOUR-BACKEND-URL/api`. The backend can run on Render with PostgreSQL.

## Production safety

- Set a long random `SECRET_KEY`.
- Use PostgreSQL rather than SQLite for multi-user deployment.
- Keep HTTPS enabled at the hosting provider.
- Replace synthetic model data before making engineering claims.

## Single-server production build on Windows

Run `BUILD_PRODUCTION_WINDOWS.bat`. This builds the React app, copies it into FastAPI, and serves the whole application from `http://127.0.0.1:8000`.


## Live prediction preview

The Prediction Lab calls `POST /api/predictions/preview` after the input values settle for 450 ms. Preview requests are authenticated but do not create database history rows. Click **Run & save prediction** to write one confirmed prediction into the user's history. This avoids stale result displays and prevents a history entry on every keypress.


## Theme update
The current interface uses the professional light-blue theme (blue accents, white panels, navy text, accessible focus states). See `THEME_UPDATE.md` for details and local Windows startup steps.
