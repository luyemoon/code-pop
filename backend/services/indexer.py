"""Repository indexing: file ingestion, symbol extraction, embeddings, call graph."""

import asyncio
import hashlib
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from core.data import call_graph, embeddings, files, symbols
from models import CallGraphEdge, CodeFile, Embedding, RepoStatus, Symbol, SymbolType
from services.embedding import EmbeddingManager
from services.websocket import ConnectionManager

if TYPE_CHECKING:
    from services.degradation import DegradationManager


def generate_mock_content(filename: str, language: str) -> str:
    """Generate realistic demo code content for the MVP."""
    if language == "python":
        if "main" in filename:
            return '''#!/usr/bin/env python3
"""Main entry point for the application."""

import asyncio
from fastapi import FastAPI
from api import router
from utils import setup_logging, initialize_db
from config import settings

app = FastAPI(title="CodePop API", version="0.1.0")

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    setup_logging()
    initialize_db()
    app.include_router(router)
    return app

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.1.0"}

async def main():
    """Main entry point."""
    application = create_app()
    import uvicorn
    await uvicorn.main(["--host", "0.0.0.0", "--port", "3000"])

if __name__ == "__main__":
    asyncio.run(main())
'''
        if "utils" in filename:
            return '''"""Utility functions for the application."""

import logging
import os
from typing import Optional

def setup_logging(level: str = "INFO") -> None:
    """Configure logging for the application."""
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

def initialize_db(connection_string: Optional[str] = None) -> None:
    """Initialize database connection."""
    from database import Database
    db_url = connection_string or os.getenv("DATABASE_URL")
    Database.initialize(db_url)

def calculate_similarity(vec1: list, vec2: list) -> float:
    """Calculate cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    return dot_product / (norm1 * norm2) if norm1 and norm2 else 0.0
'''
        if "api" in filename:
            return '''"""API routes for the application."""

from fastapi import APIRouter, HTTPException
from models import Repository, SearchQuery, SearchResult
from services import search_service, repo_service

router = APIRouter(prefix="/api")

@router.post("/repos", response_model=Repository)
async def create_repo(name: str, path: str):
    """Create a new repository."""
    return await repo_service.create_repo(name, path)

@router.get("/repos", response_model=list[Repository])
async def list_repos():
    """List all repositories."""
    return await repo_service.list_repos()

@router.post("/search", response_model=list[SearchResult])
async def search_code(query: SearchQuery):
    """Search code using hybrid retrieval."""
    return await search_service.search(query)
'''
        return '''"""Configuration settings for the application."""

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings."""
    database_url: str = "sqlite:///./codepop.db"
    api_port: int = 3000
    debug: bool = False
    log_level: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
'''
    return f"// {filename}\nconsole.log('Hello World');"


async def run_indexing(
    repo_id: str,
    embedding_manager: EmbeddingManager,
    ws_manager: ConnectionManager,
    degradation_manager: "DegradationManager",
) -> None:
    """Index a repository by generating mock files, symbols, embeddings and graph edges."""
    from core.data import repos

    repo = repos.get(repo_id)
    if not repo:
        return

    degradation_manager.report_health("indexing", "healthy")

    try:
        mock_files = [
            {"name": "main.py", "language": "python"},
            {"name": "utils.py", "language": "python"},
            {"name": "api.py", "language": "python"},
            {"name": "config.py", "language": "python"},
        ]
        total_files = len(mock_files)
        repo.indexing_progress = 0

        for i, mock_file in enumerate(mock_files):
            file_content = generate_mock_content(mock_file["name"], mock_file["language"])
            content_hash = hashlib.sha256(file_content.encode()).hexdigest()

            file = CodeFile(
                id=str(uuid.uuid4()),
                repo_id=repo_id,
                path=f"{repo.path}/{mock_file['name']}",
                language=mock_file["language"],
                content=file_content,
                content_hash=content_hash,
                size_bytes=len(file_content),
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            files[file.id] = file

            await extract_symbols_and_graph(file)
            await create_embeddings(file, embedding_manager)

            repo.indexing_progress = ((i + 1) / total_files) * 100
            repo.file_count += 1

            await ws_manager.broadcast(
                {"type": "repo_update", "repo_id": repo_id, "progress": repo.indexing_progress},
                "repos",
            )
            await asyncio.sleep(0.5)

        repo.status = RepoStatus.indexed
        repo.last_indexed_at = datetime.now()
        repo.symbol_count = len([s for s in symbols.values() if s.repo_id == repo_id])
        repo.embedding_count = len(
            [e for e in embeddings.values() if e.file_id in files and files[e.file_id].repo_id == repo_id]
        )

        await ws_manager.broadcast({"type": "repo_indexed", "repo_id": repo_id}, "repos")

    except Exception as exc:
        repo.status = RepoStatus.error
        degradation_manager.report_health("indexing", "degraded", str(exc))
        await ws_manager.broadcast(
            {"type": "repo_error", "repo_id": repo_id, "error": str(exc)},
            "repos",
        )


async def extract_symbols_and_graph(file: CodeFile) -> None:
    """Extract demo symbols and a single call graph edge from a file."""
    symbols_to_create = [
        {"name": "create_app", "type": "function", "line": 12},
        {"name": "main", "type": "function", "line": 28},
        {"name": "app", "type": "variable", "line": 10},
    ]
    created_symbols = []

    for sym_data in symbols_to_create:
        symbol = Symbol(
            id=str(uuid.uuid4()),
            file_id=file.id,
            repo_id=file.repo_id,
            name=sym_data["name"],
            type=SymbolType[sym_data["type"]],
            kind=sym_data["type"],
            line=sym_data["line"],
            column=0,
            end_line=sym_data["line"] + 5,
            end_column=0,
            is_exported=True,
        )
        symbols[symbol.id] = symbol
        created_symbols.append(symbol)

    if len(created_symbols) >= 2:
        edge = CallGraphEdge(
            id=str(uuid.uuid4()),
            source_symbol_id=created_symbols[0].id,
            target_symbol_id=created_symbols[1].id,
            source_file_id=file.id,
            target_file_id=file.id,
            repo_id=file.repo_id,
            call_type="direct",
        )
        call_graph[edge.id] = edge


async def create_embeddings(file: CodeFile, embedding_manager: EmbeddingManager) -> None:
    """Chunk a file and generate embeddings for each chunk."""
    lines = file.content.split("\n")
    chunk_size = 50
    chunks = [lines[i : i + chunk_size] for i in range(0, len(lines), chunk_size)]

    for i, chunk_lines in enumerate(chunks):
        chunk_content = "\n".join(chunk_lines)
        embedding = embedding_manager.generate_embedding(chunk_content)

        emb = Embedding(
            id=str(uuid.uuid4()),
            file_id=file.id,
            chunk_index=i,
            content=chunk_content,
            embedding=embedding,
            token_count=len(chunk_content) // 4,
            created_at=datetime.now(),
        )
        embeddings[emb.id] = emb
