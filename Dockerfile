# syntax=docker/dockerfile:1

# ---- Frontend: static export of the Next.js app ----
FROM node:24-slim AS frontend
# The build reads ../templates and ../documents.json, so they must sit next to frontend/.
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY templates/ /build/templates/
COPY documents.json /build/
RUN npm run build

# ---- Runtime: FastAPI serving the API and the static frontend ----
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
# uv is only needed to install dependencies, so it is mounted for this step, not copied.
RUN --mount=from=ghcr.io/astral-sh/uv:0.12,source=/uv,target=/bin/uv \
    uv sync --frozen --no-dev
COPY backend/app ./app
COPY documents.json ./
COPY --from=frontend /build/frontend/out ./static

# /data holds the database. The start scripts mount the prelegal-data volume there, so it
# outlives the container; a new volume takes this directory's owner, so the app can write.
RUN useradd --system --uid 10001 prelegal && mkdir /data && chown prelegal /data
USER prelegal
ENV PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_DB_PATH=/data/prelegal.db \
    PRELEGAL_STATIC_DIR=/app/static \
    PRELEGAL_DOCUMENTS_PATH=/app/documents.json

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
CMD ["uvicorn", "--factory", "app.main:create_app", "--host", "0.0.0.0", "--port", "8000"]
