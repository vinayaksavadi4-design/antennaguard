# AntennaGuard Professional Blue Theme

This update changes the frontend visual styling only. It keeps the existing React routes, authentication/session flow, FastAPI endpoints, Random Forest inference, prediction history, EDA import/verification flow, and deployment configuration unchanged.

## Theme choices
- Main theme: light professional blue
- Accent: blue (`#2563eb` / `#1d4ed8`)
- Surfaces: white and very light blue-grey
- Text: dark navy for readable contrast
- Risk statuses: red for high, amber for medium, green for low
- Inputs and buttons include visible keyboard-focus indicators

## Run on Windows
1. Extract the project ZIP.
2. Open `antennaguard_final`.
3. Run `SETUP_WINDOWS.bat` once with internet access.
4. Run `START_WINDOWS.bat`.
5. Open `http://localhost:5173`.

If dependencies are already installed, skip setup and run `START_WINDOWS.bat`. The backend API docs are available at `http://localhost:8000/docs` while the backend is running.

## Validation note
The CSS was parsed locally with no syntax errors. The frontend production build was not run here because npm installation could not complete before the package-registry request timed out. Run `npm install` and `npm run build` inside `frontend` on a machine with registry access before deployment.
