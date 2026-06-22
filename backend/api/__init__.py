"""FastAPI routers for the CodePop REST API."""

from api.mcp import router as mcp_router
from api.repos import router as repos_router
from api.search import router as search_router
from api.system import router as system_router
from api.websocket import router as ws_router

__all__ = ["repos_router", "search_router", "system_router", "mcp_router", "ws_router"]
