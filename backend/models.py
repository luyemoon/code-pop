"""Pydantic models and enums shared across the CodePop backend."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Language(str, Enum):
    typescript = "typescript"
    python = "python"
    go = "go"
    rust = "rust"
    java = "java"
    cpp = "cpp"


class RepoStatus(str, Enum):
    indexed = "indexed"
    indexing = "indexing"
    error = "error"
    degraded = "degraded"


class SymbolType(str, Enum):
    function = "function"
    class_ = "class"
    variable = "variable"
    interface = "interface"
    method = "method"
    property = "property"
    import_ = "import"


class SearchMode(str, Enum):
    semantic = "semantic"
    symbol = "symbol"
    hybrid = "hybrid"


class Repository(BaseModel):
    id: str
    name: str
    path: str
    git_url: Optional[str] = None
    status: RepoStatus = RepoStatus.indexing
    file_count: int = 0
    symbol_count: int = 0
    embedding_count: int = 0
    created_at: datetime
    updated_at: datetime
    git_modified_at: Optional[datetime] = None
    git_author: Optional[str] = None
    last_indexed_at: Optional[datetime] = None
    indexing_progress: int = 0


class Symbol(BaseModel):
    id: str
    file_id: str
    repo_id: str
    name: str
    type: SymbolType
    kind: str
    line: int
    column: int
    end_line: int
    end_column: int
    parent_id: Optional[str] = None
    is_exported: bool = False
    docstring: Optional[str] = None


class CodeFile(BaseModel):
    id: str
    repo_id: str
    path: str
    language: str
    content: str
    content_hash: str
    size_bytes: int
    created_at: datetime
    updated_at: datetime
    git_modified_at: Optional[datetime] = None


class Embedding(BaseModel):
    id: str
    file_id: str
    chunk_index: int
    content: str
    embedding: List[float]
    token_count: int
    created_at: datetime


class CallGraphEdge(BaseModel):
    id: str
    source_symbol_id: str
    target_symbol_id: str
    source_file_id: str
    target_file_id: str
    repo_id: str
    call_type: str  # direct, indirect, import


class SearchQuery(BaseModel):
    query: str
    repo_id: Optional[str] = None
    language: Optional[Language] = None
    limit: int = Field(default=20, ge=1, le=100)
    max_tokens: int = Field(default=8000, ge=100)
    mode: SearchMode = SearchMode.hybrid


class SearchResult(BaseModel):
    id: str
    file_id: str
    file_path: str
    content: str
    similarity: float
    language: str
    symbols: List[str] = []
    line: int = 0
    score: float = 0.0
    score_breakdown: Dict[str, float] = {}


class IndexProgress(BaseModel):
    repo_id: str
    total_files: int
    processed_files: int
    status: str
    error: Optional[str] = None


class SystemStatus(BaseModel):
    status: str
    version: str
    uptime: float
    active_requests: int
    indexing_tasks: int
    degraded_features: List[str] = []
    metrics: Dict[str, float] = {}


class DegradationStatus(BaseModel):
    feature: str
    status: str
    reason: Optional[str] = None
    fallback: Optional[str] = None


class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[Any] = None
    method: str
    params: Dict[str, Any] = Field(default_factory=dict)
