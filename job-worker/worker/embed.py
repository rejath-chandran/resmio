"""Local embeddings via fastembed (bge-small-en-v1.5, 384-dim). $0 per embed.

Model downloads once to the cache volume on first run.
"""

from __future__ import annotations

from functools import lru_cache

from fastembed import TextEmbedding

MODEL = "BAAI/bge-small-en-v1.5"
DIM = 384


@lru_cache(maxsize=1)
def _model() -> TextEmbedding:
    # threads=1 keeps onnxruntime's memory + CPU footprint small on a tiny EC2 box.
    return TextEmbedding(model_name=MODEL, threads=1)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return [v.tolist() for v in _model().embed(texts)]


def job_text(title: str, company: str, location: str, description: str) -> str:
    # What we embed for a job. Keep symmetric with the app's resumeToText().
    return f"{title} at {company}. {location}. {description}"[:4000]
