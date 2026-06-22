"""In-memory data stores used across the application.

These are intentionally simple for the MVP stage. They are encapsulated here so
that a persistent database adapter can be introduced without touching business
logic.
"""

from typing import Any, Dict, List

from models import CallGraphEdge, CodeFile, Embedding, IndexProgress, Repository, Symbol

# Repository and indexing state
repos: Dict[str, Repository] = {}
index_tasks: Dict[str, IndexProgress] = {}

# Code artifacts
files: Dict[str, CodeFile] = {}
symbols: Dict[str, Symbol] = {}
embeddings: Dict[str, Embedding] = {}
call_graph: Dict[str, CallGraphEdge] = {}

# Observability
search_history: List[Dict[str, Any]] = []
