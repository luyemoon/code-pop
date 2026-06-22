"""Repository management routes."""

import asyncio
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from core.data import call_graph, embeddings, files, repos, symbols
from models import Repository
from services.indexer import run_indexing
from state import degradation_manager, embedding_manager, ws_manager

router = APIRouter(prefix="/api/repos")


@router.post("", response_model=Repository)
async def create_repo(name: str, path: str, git_url: Optional[str] = None):
    """Create a new code repository and start indexing."""
    start_time = time.time()

    if any(r.path == path for r in repos.values()):
        raise HTTPException(status_code=409, detail="仓库已存在")

    repo_id = str(uuid.uuid4())
    now = datetime.now()

    repo = Repository(
        id=repo_id,
        name=name,
        path=path,
        git_url=git_url,
        created_at=now,
        updated_at=now,
    )
    repos[repo_id] = repo

    asyncio.create_task(
        run_indexing(repo_id, embedding_manager, ws_manager, degradation_manager)
    )

    degradation_manager.record_latency((time.time() - start_time) * 1000)
    return repo


@router.get("", response_model=list[Repository])
async def list_repos():
    """List all registered repositories."""
    return list(repos.values())


@router.get("/{repo_id}", response_model=Repository)
async def get_repo(repo_id: str):
    """Get a single repository by ID."""
    repo = repos.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="仓库不存在")
    return repo


@router.patch("/{repo_id}", response_model=Repository)
async def update_repo(repo_id: str, name: Optional[str] = None):
    """Update repository metadata."""
    repo = repos.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="仓库不存在")

    if name:
        repo.name = name
    repo.updated_at = datetime.now()
    return repo


@router.delete("/{repo_id}")
async def delete_repo(repo_id: str):
    """Delete a repository and all associated data."""
    if repo_id not in repos:
        raise HTTPException(status_code=404, detail="仓库不存在")

    files_to_delete = [fid for fid, f in files.items() if f.repo_id == repo_id]
    for fid in files_to_delete:
        del files[fid]

    symbols_to_delete = [sid for sid, s in symbols.items() if s.file_id in files_to_delete]
    for sid in symbols_to_delete:
        del symbols[sid]

    embeddings_to_delete = [eid for eid, e in embeddings.items() if e.file_id in files_to_delete]
    for eid in embeddings_to_delete:
        del embeddings[eid]

    edges_to_delete = [eid for eid, e in call_graph.items() if e.repo_id == repo_id]
    for eid in edges_to_delete:
        del call_graph[eid]

    del repos[repo_id]
    return {"status": "success"}


@router.post("/{repo_id}/index")
async def trigger_index(repo_id: str):
    """Manually re-trigger indexing for a repository."""
    from models import RepoStatus

    repo = repos.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="仓库不存在")

    repo.status = RepoStatus.indexing
    repo.indexing_progress = 0
    repo.updated_at = datetime.now()

    asyncio.create_task(
        run_indexing(repo_id, embedding_manager, ws_manager, degradation_manager)
    )
    return {"status": "indexing", "repo_id": repo_id}


@router.get("/{repo_id}/files")
async def get_repo_files(repo_id: str):
    """List files belonging to a repository."""
    if repo_id not in repos:
        raise HTTPException(status_code=404, detail="仓库不存在")
    return [f for f in files.values() if f.repo_id == repo_id]


@router.get("/{repo_id}/symbols")
async def get_repo_symbols(repo_id: str):
    """List symbols belonging to a repository."""
    if repo_id not in repos:
        raise HTTPException(status_code=404, detail="仓库不存在")
    repo_files = {fid for fid, f in files.items() if f.repo_id == repo_id}
    return [s for s in symbols.values() if s.file_id in repo_files]


@router.get("/{repo_id}/call-graph")
async def get_repo_call_graph(repo_id: str):
    """Get the call graph edges for a repository."""
    if repo_id not in repos:
        raise HTTPException(status_code=404, detail="仓库不存在")
    return {"edges": [e for e in call_graph.values() if e.repo_id == repo_id]}
