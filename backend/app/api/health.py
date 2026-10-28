"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by the Docker HEALTHCHECK. Deliberately touches nothing else."""
    return {"status": "ok"}
