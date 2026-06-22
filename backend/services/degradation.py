"""Degradation and circuit-breaker style health management."""

import time
from typing import Any, Dict, List, Optional


class DegradationManager:
    """Tracks feature health and exposes system status / metrics."""

    def __init__(self):
        self.features: Dict[str, Dict[str, Optional[str]]] = {
            "embedding": {"status": "healthy", "reason": None, "fallback": None},
            "search": {"status": "healthy", "reason": None, "fallback": None},
            "indexing": {"status": "healthy", "reason": None, "fallback": None},
            "graph": {"status": "healthy", "reason": None, "fallback": None},
        }
        self.metrics: Dict[str, float] = {
            "request_count": 0,
            "error_count": 0,
            "latency_ms": 0,
            "avg_latency_ms": 0,
            "indexing_queue_length": 0,
        }
        self.start_time = time.time()

    def report_health(self, feature: str, status: str, reason: Optional[str] = None):
        """Report the health status of a feature."""
        if feature in self.features:
            self.features[feature]["status"] = status
            self.features[feature]["reason"] = reason
            self.features[feature]["fallback"] = "使用降级模式" if status == "degraded" else None

    def increment_metric(self, metric: str, value: float = 1):
        """Increment a numeric metric."""
        if metric in self.metrics:
            self.metrics[metric] += value

    def record_latency(self, latency_ms: float):
        """Record request latency and update average."""
        self.metrics["latency_ms"] += latency_ms
        self.metrics["request_count"] += 1
        self.metrics["avg_latency_ms"] = self.metrics["latency_ms"] / self.metrics["request_count"]

    def get_status(self) -> Dict[str, Any]:
        """Return the current system status snapshot."""
        degraded_features = [
            feature for feature, info in self.features.items()
            if info["status"] != "healthy"
        ]
        return {
            "status": "healthy" if not degraded_features else "degraded",
            "uptime": time.time() - self.start_time,
            "active_requests": int(self.metrics["request_count"]),
            "indexing_tasks": int(self.metrics["indexing_queue_length"]),
            "degraded_features": degraded_features,
            "metrics": self.metrics,
            "features": self.features,
        }
