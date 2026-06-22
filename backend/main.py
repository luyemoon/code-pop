"""CodePop FastAPI application entry point."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import mcp_router, repos_router, search_router, system_router, ws_router
from config import settings


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="CodePop API",
        description="面向 AI Agent 的代码专用检索基础设施 - 四路召回混合检索引擎",
        version=settings.api_version,
        docs_url="/api-docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(system_router)
    app.include_router(repos_router)
    app.include_router(search_router)
    app.include_router(mcp_router)
    app.include_router(ws_router)

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
