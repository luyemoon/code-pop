"""System health, metrics and degradation status routes."""

from fastapi import APIRouter, Response

from config import settings
from models import SystemStatus
from state import degradation_manager

router = APIRouter(prefix="/api")


@router.get("/health", response_model=SystemStatus)
async def health():
    """Overall health check."""
    status = degradation_manager.get_status()
    return SystemStatus(
        status=status["status"],
        version=settings.api_version,
        uptime=status["uptime"],
        active_requests=status["active_requests"],
        indexing_tasks=status["indexing_tasks"],
        degraded_features=status["degraded_features"],
        metrics=status["metrics"],
    )


@router.get("/health/ready")
async def health_ready():
    """Readiness probe."""
    return {"status": "ready"}


@router.get("/health/live")
async def health_live():
    """Liveness probe."""
    return {"status": "live"}


@router.get("/metrics")
async def get_metrics():
    """Prometheus-compatible metrics endpoint."""
    status = degradation_manager.get_status()
    metrics = status["metrics"]

    lines = [
        "# HELP codepop_request_count Total requests",
        "# TYPE codepop_request_count counter",
        f"codepop_request_count {metrics['request_count']}",
        "# HELP codepop_error_count Total errors",
        "# TYPE codepop_error_count counter",
        f"codepop_error_count {metrics['error_count']}",
        "# HELP codepop_avg_latency_ms Average latency",
        "# TYPE codepop_avg_latency_ms gauge",
        f"codepop_avg_latency_ms {metrics['avg_latency_ms']}",
        "# HELP codepop_indexing_tasks Active indexing tasks",
        "# TYPE codepop_indexing_tasks gauge",
        f"codepop_indexing_tasks {metrics['indexing_queue_length']}",
        "# HELP codepop_uptime_seconds Uptime in seconds",
        "# TYPE codepop_uptime_seconds gauge",
        f"codepop_uptime_seconds {status['uptime']}",
    ]

    return Response(content="\n".join(lines), media_type="text/plain")


@router.get("/degradation")
async def get_degradation_status():
    """Return degradation status for each feature."""
    return degradation_manager.get_status()["features"]
