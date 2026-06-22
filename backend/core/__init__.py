"""Core shared state and data stores for the CodePop backend."""

from core.data import (
    call_graph,
    embeddings,
    files,
    index_tasks,
    repos,
    search_history,
    symbols,
)

__all__ = [
    "repos",
    "files",
    "symbols",
    "embeddings",
    "call_graph",
    "search_history",
    "index_tasks",
]
