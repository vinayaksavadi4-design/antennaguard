FROM python:3.14-slim
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY frontend/package.json ./frontend/package.json
COPY frontend/index.html ./frontend/index.html
COPY frontend/vite.config.js ./frontend/vite.config.js
COPY frontend/src ./frontend/src
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*
RUN cd frontend && npm install && npm run build && cp -r dist/* /app/backend/app/static/
WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
