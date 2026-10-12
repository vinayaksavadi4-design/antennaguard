# AntennaGuard: React frontend + FastAPI backend in one Voroa container
FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend

COPY frontend/package.json ./
COPY frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html ./index.html
COPY frontend/vite.config.js ./vite.config.js
COPY frontend/src ./src
RUN npm run build

FROM python:3.14-slim
WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY --from=frontend-build /src/frontend/dist ./backend/app/static

WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3000}"]
