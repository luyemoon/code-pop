"""Four-way hybrid retrieval engine: vector + symbol + BM25 + graph."""

import math
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

from config import EMBEDDING_DIM
from core.data import call_graph, embeddings, files, symbols
from models import SearchQuery, SearchResult
from services.embedding import EmbeddingManager


class SearchEngine:
    """Hybrid search engine combining multiple retrieval strategies."""

    def __init__(self, embedding_manager: EmbeddingManager, max_workers: int = 4):
        self.embedding_manager = embedding_manager
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def search(self, query: SearchQuery) -> List[SearchResult]:
        """Run four-way recall and re-rank the merged candidates."""
        query_embedding = self.embedding_manager.generate_embedding(query.query)

        vector_results = await self._vector_search(query, query_embedding)
        symbol_results = await self._symbol_search(query)
        bm25_results = await self._bm25_search(query)
        graph_results = await self._graph_search(query)

        merged = self._merge_results(vector_results, symbol_results, bm25_results, graph_results)
        return self._hybrid_rerank(merged, query_embedding)[: query.limit]

    async def _vector_search(self, query: SearchQuery, query_embedding: List[float]) -> List[Dict[str, Any]]:
        results = []
        repo_filter = query.repo_id

        for emb in embeddings.values():
            file = files.get(emb.file_id)
            if not file:
                continue
            if repo_filter and file.repo_id != repo_filter:
                continue

            similarity = self._cosine_similarity(query_embedding, emb.embedding)
            if similarity > 0.5:
                results.append(
                    {
                        "id": emb.id,
                        "file_id": emb.file_id,
                        "content": emb.content,
                        "similarity": similarity,
                        "source": "vector",
                        "file_path": file.path,
                        "language": file.language,
                    }
                )

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:50]

    async def _symbol_search(self, query: SearchQuery) -> List[Dict[str, Any]]:
        results = []
        repo_filter = query.repo_id
        query_lower = query.query.lower()
        query_tokens = query_lower.split()

        for symbol in symbols.values():
            file = files.get(symbol.file_id)
            if not file:
                continue
            if repo_filter and file.repo_id != repo_filter:
                continue

            symbol_name = symbol.name.lower()
            score = 0.0

            if query_lower == symbol_name:
                score += 3.0
            elif symbol_name.startswith(query_lower):
                score += 2.0
            elif query_lower in symbol_name:
                score += 1.0

            for token in query_tokens:
                if token in symbol_name:
                    score += 0.5

            if score > 0:
                results.append(
                    {
                        "id": symbol.id,
                        "file_id": symbol.file_id,
                        "symbol_name": symbol.name,
                        "score": score,
                        "source": "symbol",
                        "file_path": file.path,
                        "language": file.language,
                        "line": symbol.line,
                    }
                )

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:30]

    async def _bm25_search(self, query: SearchQuery) -> List[Dict[str, Any]]:
        results = []
        repo_filter = query.repo_id
        k1 = 1.5
        b = 0.75

        query_tokens = query.query.lower().split()
        doc_count = len(files)

        df = defaultdict(int)
        for file in files.values():
            if repo_filter and file.repo_id != repo_filter:
                continue
            file_tokens = set(file.content.lower().split())
            for token in query_tokens:
                if token in file_tokens:
                    df[token] += 1

        avg_doc_len = (
            sum(len(f.content.split()) for f in files.values()) / max(doc_count, 1)
        )

        for file in files.values():
            if repo_filter and file.repo_id != repo_filter:
                continue

            score = 0.0
            file_tokens = file.content.lower().split()
            doc_len = len(file_tokens)

            for token in query_tokens:
                tf = file_tokens.count(token)
                if tf == 0:
                    continue

                idf = math.log((doc_count - df[token] + 0.5) / (df[token] + 0.5) + 1)
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * doc_len / avg_doc_len)
                score += idf * numerator / denominator

            if score > 0.1:
                results.append(
                    {
                        "id": file.id,
                        "file_id": file.id,
                        "content": file.content[:500],
                        "score": score,
                        "source": "bm25",
                        "file_path": file.path,
                        "language": file.language,
                    }
                )

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:30]

    async def _graph_search(self, query: SearchQuery) -> List[Dict[str, Any]]:
        results = []
        repo_filter = query.repo_id
        query_tokens = query.query.lower().split()

        related_symbols = {
            symbol.id
            for symbol in symbols.values()
            if any(token in symbol.name.lower() for token in query_tokens)
        }

        for edge in call_graph.values():
            if repo_filter and edge.repo_id != repo_filter:
                continue

            if edge.source_symbol_id in related_symbols or edge.target_symbol_id in related_symbols:
                source_sym = symbols.get(edge.source_symbol_id)
                target_sym = symbols.get(edge.target_symbol_id)
                source_file = files.get(edge.source_file_id)

                if source_file:
                    results.append(
                        {
                            "id": edge.id,
                            "file_id": edge.source_file_id,
                            "source": "graph",
                            "score": 1.0,
                            "file_path": source_file.path,
                            "language": source_file.language,
                            "relation": f"{source_sym.name if source_sym else 'unknown'} -> {target_sym.name if target_sym else 'unknown'}",
                        }
                    )

        return results[:20]

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        return dot / (norm_a * norm_b) if norm_a > 0 and norm_b > 0 else 0.0

    @staticmethod
    def _merge_results(*result_lists: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        merged: Dict[str, Dict[str, Any]] = {}

        for results in result_lists:
            for result in results:
                key = f"{result['file_id']}-{result.get('chunk_index', 0)}"
                if key not in merged:
                    merged[key] = {
                        "file_id": result["file_id"],
                        "file_path": result["file_path"],
                        "language": result["language"],
                        "content": result.get("content", ""),
                        "sources": [],
                        "scores": {},
                    }

                merged[key]["sources"].append(result["source"])
                merged[key]["scores"][result["source"]] = result.get("similarity", result.get("score", 0.0))

        return list(merged.values())

    def _hybrid_rerank(self, results: List[Dict[str, Any]], query_embedding: List[float]) -> List[SearchResult]:
        weights = {
            "vector": 0.4,
            "symbol": 0.3,
            "bm25": 0.2,
            "graph": 0.1,
        }

        final_results = []
        for result in results:
            total_score = sum(
                score * weights.get(source, 0.1)
                for source, score in result["scores"].items()
            )
            if "symbol" in result["sources"] and "vector" in result["sources"]:
                total_score += 0.1

            final_results.append(
                {
                    **result,
                    "score": total_score,
                    "score_breakdown": result["scores"],
                }
            )

        final_results.sort(key=lambda x: x["score"], reverse=True)

        return [
            SearchResult(
                id=str(uuid.uuid4()),
                file_id=r["file_id"],
                file_path=r["file_path"],
                content=r["content"],
                similarity=r["scores"].get("vector", 0.0),
                language=r["language"],
                score=r["score"],
                score_breakdown=r["score_breakdown"],
            )
            for r in final_results
        ]
