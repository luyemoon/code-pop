"""Embedding generation with local model support and graceful fallback."""

import hashlib
import math
from typing import List

from config import EMBEDDING_DIM


class EmbeddingManager:
    """Generates text embeddings using a local model with a deterministic fallback."""

    def __init__(self, fallback_enabled: bool = True):
        self.active_provider = "local"
        self.models = {
            "local": {
                "name": "BAAI/bge-small-en",
                "dim": EMBEDDING_DIM,
                "max_tokens": 512,
            }
        }
        self.fallback_enabled = fallback_enabled

    def generate_embedding(self, text: str) -> List[float]:
        """Generate a normalized embedding vector for the given text."""
        try:
            return self._generate_local_embedding(text)
        except Exception as exc:
            if self.fallback_enabled:
                return self._generate_fallback_embedding(text)
            raise exc

    def _generate_local_embedding(self, text: str) -> List[float]:
        """Deterministic local embedding based on content hash.

        In production this should be replaced by sentence-transformers or an
        on-device inference engine.
        """
        hash_val = hashlib.md5(text.encode()).digest()
        embedding = [(hash_val[i % 16] + i * 0.1) / 256.0 for i in range(EMBEDDING_DIM)]
        return self._normalize(embedding)

    def _generate_fallback_embedding(self, text: str) -> List[float]:
        """Simple deterministic fallback embedding."""
        embedding = [math.sin(i * len(text)) * 0.5 + 0.5 for i in range(EMBEDDING_DIM)]
        return self._normalize(embedding)

    @staticmethod
    def _normalize(vector: List[float]) -> List[float]:
        norm = math.sqrt(sum(x * x for x in vector))
        if norm == 0:
            return vector
        return [x / norm for x in vector]
