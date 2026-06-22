"""Global service instances and shared state wiring."""

from services.degradation import DegradationManager
from services.embedding import EmbeddingManager
from services.search import SearchEngine
from services.websocket import ConnectionManager

embedding_manager = EmbeddingManager()
search_engine = SearchEngine(embedding_manager=embedding_manager)
degradation_manager = DegradationManager()
ws_manager = ConnectionManager()
