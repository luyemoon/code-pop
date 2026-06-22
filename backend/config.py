"""CodePop backend configuration."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    api_host: str = "0.0.0.0"
    api_port: int = 3000
    api_version: str = "0.1.0"
    log_level: str = "INFO"

    # Vector embedding
    embedding_dim: int = 384
    embedding_max_tokens: int = 512

    # Search
    search_max_tokens: int = 8000
    search_default_limit: int = 20

    # Retry / circuit breaker
    max_retries: int = 3
    retry_delay_seconds: float = 1.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

MAX_RETRIES = settings.max_retries
RETRY_DELAY = settings.retry_delay_seconds
EMBEDDING_DIM = settings.embedding_dim
EMBEDDING_MAX_TOKENS = settings.embedding_max_tokens
MAX_TOKENS = settings.search_max_tokens
