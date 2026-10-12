# AntennaGuard live prediction fix

## What changed

- The Prediction Lab now performs a live preview about 450 ms after valid inputs settle.
- `POST /api/predictions/preview` runs the ML model without creating a history row.
- **Run & save prediction** still creates one persistent history entry.
- The result panel lists the exact feature values that were evaluated and labels the output as either a live preview or a saved run.
- Invalid values and expired sessions show an explicit message rather than leaving an old result on screen.
- The synthetic demo model is now version `synthetic-v2`; an older cached `synthetic-v1` model is automatically regenerated.
- Tests cover risk variation and old model-cache invalidation.

## Install the fix on Windows

1. Stop both AntennaGuard terminal windows with `Ctrl+C`.
2. Download and extract this ZIP. To preserve your existing login and history, extract/merge the `antennaguard_final` files into the project folder you are already using and allow the updated source files to replace the old ones. Do not delete `backend/antennaguard.db`, `backend/.venv`, or `frontend/node_modules`.
3. Start the backend again with the `START_WINDOWS.bat` in that project folder, or use `uvicorn app.main:app --reload --port 8000` from its `backend` folder with the virtual environment active.
4. Start the frontend again with `npm run dev` from its `frontend` folder.
5. Refresh the browser. Open **Prediction Lab**, change a valid value, and wait about half a second. The right-hand result panel should update automatically.
6. Click **Run & save prediction** to save the current inputs and output to History.

## Research disclaimer

This bundled Random Forest uses synthetic demonstration data. Its live probabilities are useful for demonstrating software behavior, not as validated foundry or DRC predictions. Replace the synthetic training data with validated physical-design/DRC examples before reporting engineering accuracy.
