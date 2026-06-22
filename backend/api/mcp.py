"""MCP (Model Context Protocol) server endpoint."""

import json
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from core.data import call_graph, files, repos
from models import MCPRequest, SearchQuery
from state import degradation_manager, search_engine

router = APIRouter()


@router.post("/mcp")
async def mcp_handler(request: MCPRequest):
    """Handle MCP tool/list and tool/call requests."""
    import time

    start_time = time.time()

    try:
        if request.method == "tools/call":
            tool_name = request.params.get("name")
            arguments = request.params.get("arguments", {})
            result = await _handle_mcp_tool(tool_name, arguments)
            degradation_manager.record_latency((time.time() - start_time) * 1000)
            return {
                "jsonrpc": "2.0",
                "id": request.id,
                "result": {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]},
            }

        if request.method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": request.id,
                "result": {"tools": _get_mcp_tools()},
            }

        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "error": {"code": -32601, "message": "Method not found"},
        }
    except Exception as exc:
        degradation_manager.increment_metric("error_count")
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "error": {"code": -32603, "message": str(exc)},
        }


async def _handle_mcp_tool(tool_name: str, arguments: Dict[str, Any]):
    tools = {
        "search_code": _search_code,
        "get_repo_info": _get_repo_info,
        "list_repos": _list_repos,
        "index_repo": _index_repo,
        "get_file_content": _get_file_content,
        "get_call_graph": _get_call_graph,
    }

    if tool_name not in tools:
        raise HTTPException(status_code=400, detail=f"Tool not found: {tool_name}")

    return await tools[tool_name](arguments)


async def _search_code(args: Dict[str, Any]):
    query = args.get("query", "")
    repo_id = args.get("repo_id")
    results = await search_engine.search(SearchQuery(query=query, repo_id=repo_id, limit=10))
    return {"results": [r.dict() for r in results]}


async def _get_repo_info(args: Dict[str, Any]):
    repo_id = args.get("repo_id")
    repo = repos.get(repo_id)
    if not repo:
        return {"error": "Repository not found"}
    return repo.dict()


async def _list_repos(_args: Dict[str, Any]):
    return {"repos": [r.dict() for r in repos.values()]}


async def _index_repo(args: Dict[str, Any]):
    from api.repos import create_repo

    path = args.get("path")
    existing = next((r for r in repos.values() if r.path == path), None)
    if existing:
        from api.repos import trigger_index

        await trigger_index(existing.id)
        return {"status": "indexing", "repo_id": existing.id}

    name = path.split("/")[-1]
    repo = await create_repo(name=name, path=path)
    return {"status": "created", "repo_id": repo.id}


async def _get_file_content(args: Dict[str, Any]):
    file_id = args.get("file_id")
    file = files.get(file_id)
    if not file:
        return {"error": "File not found"}
    return {"content": file.content, "path": file.path, "language": file.language}


async def _get_call_graph(args: Dict[str, Any]):
    repo_id = args.get("repo_id")
    edges = [e.dict() for e in call_graph.values() if e.repo_id == repo_id]
    return {"edges": edges}


def _get_mcp_tools():
    return [
        {
            "name": "search_code",
            "description": "四路召回混合语义代码搜索",
            "parameters": {
                "query": {"type": "string", "description": "搜索查询"},
                "repo_id": {"type": "string", "description": "仓库ID（可选）"},
            },
        },
        {
            "name": "get_repo_info",
            "description": "获取仓库详细信息",
            "parameters": {"repo_id": {"type": "string", "description": "仓库ID"}},
        },
        {
            "name": "list_repos",
            "description": "列出所有已索引仓库",
            "parameters": {},
        },
        {
            "name": "index_repo",
            "description": "索引新仓库",
            "parameters": {"path": {"type": "string", "description": "仓库路径"}},
        },
        {
            "name": "get_file_content",
            "description": "获取文件内容",
            "parameters": {"file_id": {"type": "string", "description": "文件ID"}},
        },
        {
            "name": "get_call_graph",
            "description": "获取函数调用图",
            "parameters": {"repo_id": {"type": "string", "description": "仓库ID"}},
        },
    ]
