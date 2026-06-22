"""Search routes."""

import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from core.data import files, search_history, symbols
from models import SearchQuery, SearchResult
from state import degradation_manager, search_engine

router = APIRouter(prefix="/api/search")


@router.post("", response_model=list[SearchResult])
async def search_code(query: SearchQuery):
    """Run the four-way hybrid retrieval engine."""
    start_time = time.time()

    try:
        results = await search_engine.search(query)
        search_history.append(
            {
                "query": query.query,
                "timestamp": datetime.now().isoformat(),
                "results": len(results),
                "mode": query.mode.value,
            }
        )
        degradation_manager.record_latency((time.time() - start_time) * 1000)
        degradation_manager.increment_metric("request_count")
        return results
    except Exception as exc:
        degradation_manager.report_health("search", "degraded", str(exc))
        degradation_manager.increment_metric("error_count")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/symbol")
async def search_symbol(query: str, repo_id: Optional[str] = None, limit: int = 20):
    """Search symbols by name."""
    results = []
    for symbol in symbols.values():
        file = files.get(symbol.file_id)
        if not file:
            continue
        if repo_id and file.repo_id != repo_id:
            continue
        if query.lower() in symbol.name.lower():
            results.append(
                {
                    "id": symbol.id,
                    "name": symbol.name,
                    "type": symbol.type.value,
                    "kind": symbol.kind,
                    "file_path": file.path,
                    "language": file.language,
                    "line": symbol.line,
                    "is_exported": symbol.is_exported,
                }
            )
    return results[:limit]


@router.get("/history")
async def get_search_history(limit: int = 10):
    """Return recent search history."""
    return search_history[-limit:][::-1]
