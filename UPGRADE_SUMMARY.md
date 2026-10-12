# AntennaGuard 2.1 upgrade summary

This update preserves the existing React/Vite + FastAPI + Random Forest application, its login/session flow, original prediction endpoints, saved prediction history, batch CSV route, and deployment scripts.

## Included changes

1. **More complete model evaluation**
   - Reproducible stratified 80/20 held-out split.
   - Accuracy, precision, recall, F1-score, ROC-AUC, confusion matrix, test-set size, and class balance stored with the model package.
   - Global Random Forest feature importance available through `/api/model-info` and the Reports page.
   - Model package version bumped so a previous local pickle is regenerated with the new evaluation metadata.

2. **Prediction diagnostics**
   - Tree-vote agreement and indicative input factors are added to preview, saved prediction, history, and batch responses.
   - Inputs outside the synthetic training domain are called out.
   - Scores and indicators explicitly state they are uncalibrated and not foundry verification.

3. **Baseline/revised comparison**
   - `POST /api/predictions/compare` compares two parameter sets through the same existing inference package without creating history rows.
   - Prediction Lab has a button to use this API comparison and report the score change.

4. **Normalized EDA feature import**
   - `POST /api/eda/import` accepts CSV or JSON, validates all rows, saves source metadata and file SHA-256, and supports common header aliases.
   - Imports are limited to 5 MB and 5,000 rows and are stored separately from training data.
   - `scripts/join_eda_features_and_violations.py` joins a per-net feature export to a normalized checker-result table by design and net. It leaves missing labels blank unless a complete-report flag is explicitly provided.
   - `eda_import_template.csv` and `docs/EDA_IMPORT_GUIDE.md` describe the import contract.

5. **Actual verification / correction record**
   - EDA Verification page records technology, rule deck, checker tool, result, violation count, correction attempted, notes, report reference, and optional report SHA-256.
   - Verification can be linked to a saved prediction, but the pre-correction features are never automatically labelled with a post-correction outcome. A labelled dataset row requires an explicit six-feature snapshot of the exact layout that was checked.
   - Verified records can be exported through `GET /api/eda/verified-dataset.csv`.

6. **External validation without retraining**
   - `GET /api/eda/evaluation` compares the unchanged live model with labelled imported EDA rows.
   - Optional `technology` and `rule_deck` filters reduce accidental mixing across process profiles.
   - The UI shows metrics and confusion matrix when both classes are available. Otherwise it explains which labels are missing.

## UI features merged from the AntennaGuard Pro HTML reference

- Matched the reference's deep navy, cyan/teal and amber palette across the existing React app, including the authentication pages and diagnostic cards.
- Dashboard now shows backend and model readiness, validation report availability, saved prediction totals, labelled EDA rows, and the four-stage workflow.
- Added a dedicated **Batch import** page using the existing authenticated FastAPI batch route. It validates CSV through the backend, displays severity totals and results, and downloads a results CSV generated from the API response.
- Added a dedicated **Validation** route to the existing model evaluation report and a **Workflow** guide with the feature schema, architecture, local API instructions and limitations.
- Kept existing `/predict`, `/verification`, `/history`, and `/reports` paths working. `/analyze` also routes to the single-net Prediction Lab.

## Important limits

The project still does not parse arbitrary GDSII/OASIS or execute OpenROAD/Cadence/foundry rule decks itself. EDA import expects normalized per-net records where the six input features have been combined with metadata and, optionally, a verified label. The actual checker must be run externally. Imported data do not auto-retrain the live model.

The built-in Random Forest is still trained on deterministic synthetic labels. Its held-out metrics measure behavior on the generated demo dataset only, not real-world antenna-rule accuracy. External evaluation becomes meaningful only after importing complete, correctly labelled checker results for the matching design and rule-deck version.

## Validation performed in this environment

- Backend unit tests: **10 passed**.
- FastAPI smoke checks: model metadata, preview/save, parameter comparison, EDA CSV import, external evaluation, linked correction record, and verified-dataset export passed in a local test harness.
- Frontend JSX/JS syntax checks using the locally available TypeScript parser passed.
- A production Vite build could not be executed because npm package installation was blocked by DNS/network access to `registry.npmjs.org`. After extracting the ZIP on a machine with npm registry access, run `npm install` and `npm run build` in `frontend/` to complete the production bundle check.

## Windows start

1. Extract the ZIP.
2. Run `SETUP_WINDOWS.bat` once.
3. Run `START_WINDOWS.bat` for development, or run `BUILD_PRODUCTION_WINDOWS.bat` for the combined production-style build and local server.
4. Open `http://localhost:5173` for development or `http://127.0.0.1:8000` for the combined production-style run.
