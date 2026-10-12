# AntennaGuard 2.1 validation report

## Scope

Reviewed the updated React/Vite frontend source, FastAPI backend, Random Forest evaluation package, normalized EDA data import, external evaluation, verification/correction storage, and dataset-export path. No live hosting account was used and no commercial EDA tool or foundry rule deck was run.

## Automated checks completed

- Python compile checks: passed for backend app, backend tests, and EDA helper script.
- Backend unit tests: **10 passed**.
- API smoke checks passed for model metadata, authenticated preview/save, parameter comparison, normalized EDA CSV import, filtered external evaluation, linked verification/correction record, and verified CSV dataset export.
- EDA join-helper smoke check confirmed that a missing net label remains blank unless the operator explicitly asserts the report is complete.
- Frontend JSX/JavaScript syntax checks passed using the TypeScript parser available in this environment.

## Build limitation

The frontend production build was not run because `npm install` could not resolve `registry.npmjs.org` (DNS/network access error). Run `npm install` and `npm run build` from `frontend/` on a machine with npm registry access before public release. The API smoke test environment lacked the declared `pwdlib` package, so it used a temporary test-only password-hash shim; normal use must install the project's pinned `backend/requirements.txt` and must not use the shim.

## ML validity boundary

The bundled Random Forest is trained on deterministic synthetic data. Accuracy, precision, recall, F1, ROC-AUC, confusion matrix, and feature importance are evaluation outputs for a stratified hold-out split of that synthetic dataset. They are not foundry-qualified results. Real external evaluation is provided for user-imported labelled EDA records, but the report provenance and labels must be reviewed by the user. The model does not parse arbitrary GDSII/OASIS, execute a technology rule deck, or automatically repair physical layout geometry.

## Before public deployment

1. Run the full setup and frontend production build on a network-enabled system.
2. Verify the generated environment variables, HTTPS, unique `SECRET_KEY`, allowed CORS origins, and database service.
3. Create a test account and verify login, prediction, history, CSV batch, EDA import, verification, and dataset export in the browser.
4. Replace synthetic training labels with appropriate, complete EDA-rule-check data before making real-world accuracy claims.
