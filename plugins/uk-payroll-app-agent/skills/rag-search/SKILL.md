---
name: rag-search
description: "Use this skill to perform a semantic search over the indexed UK Payroll App documentation in memory/shared/long-term/. Use when a user question requires knowledge of app features, HMRC rules, processes, or error codes. Returns the most relevant documentation excerpts."
allowed-tools:
  - read_file
scope: plugin
---

## rag-search

Performs a semantic similarity search over the RAG vector store and returns the top-k most relevant chunks.

### Input

```json
{
  "query": "string — natural language query from the user or orchestrator",
  "topK": 5,
  "filters": {
    "source": "user-guide | hmrc-guidance | error-catalogue | release-notes | null"
  }
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "chunks": [
      {
        "text": "string — the relevant documentation excerpt",
        "source": "string — document name and section",
        "score": 0.92
      }
    ]
  }
}
```

### Notes

- `topK` defaults to 5 if not provided. Maximum is 20.
- `filters.source` narrows the search to a specific document category. Use `null` to search all sources.
- Chunks are ranked by cosine similarity score (higher = more relevant).
- If no relevant chunks are found (all scores < 0.5), return an empty array — do not fabricate content.

> **Implementation note** (Phase 8): RAG index lives at `memory/shared/long-term/`.
> Vector store engine TBD (e.g. ChromaDB, pgvector, or file-based embeddings).
