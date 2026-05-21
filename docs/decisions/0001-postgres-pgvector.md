# ADR 0001 — Postgres + pgvector as the single primary datastore

**Date:** 2026-05-19
**Status:** Accepted

## Context

Ojas needs to store relational patient data (visits, medications, diagnoses, lab results) and dense vector embeddings for semantic retrieval side-by-side. The common pattern in the industry is to use separate specialized databases: a relational store (Postgres) plus a dedicated vector database (Pinecone, Weaviate, Qdrant, Milvus). We evaluated whether to follow that pattern.

Key constraints:
- Patient data must stay in India (data residency). Fewer managed services in Indian regions → operational overhead of more systems is higher.
- Every extracted fact must link back to its source artifact via a foreign key. Cross-store joins between a relational DB and a vector DB require application-side stitching, which is error-prone.
- Team is small. Operational simplicity is a feature.
- HIPAA/DPDP compliance requires auditable, transactional data access. Distributed writes across two stores make this harder.

## Decision

Use **Postgres 16 with the pgvector extension** as the single primary datastore for both relational data and vector embeddings.

- All embeddings stored in an `embeddings` table with a `vector(1536)` column (or appropriate dimension for the chosen embedding model).
- JSONB used for long-tail extracted fields not queried relationally.
- Hybrid search (keyword BM25 + semantic vector) implemented via `pg_trgm` + `pgvector` with reciprocal rank fusion at the application layer.
- No MongoDB, no Cassandra, no separate vector database.

## Consequences

**Good:**
- Single system to operate, monitor, back up, and audit.
- Transactional integrity: vector upserts and relational updates happen in the same transaction, so `embeddings.source_artifact_id` FK is always consistent.
- pgvector supports HNSW indexing (fast approximate nearest neighbor); sufficient for per-patient scope queries (<<1M vectors per patient).
- Alembic handles schema evolution uniformly for both relational and vector columns.

**Accepted trade-offs:**
- pgvector is not as fast as dedicated vector DBs for billion-scale global search. Mitigated by per-patient scoping — queries never touch the full table.
- No built-in BM25 in Postgres. Using `tsvector` + `pg_trgm` for keyword matching (good enough for medical terminology with controlled vocabulary).
- If we ever need cross-clinic population-level analytics (e.g., drug interaction signals), a separate read replica or data warehouse will be needed. This is explicitly out of scope for v0-v1.

## Alternatives considered

| Option | Rejected because |
|---|---|
| Postgres + Pinecone | Cross-store FK consistency impossible; extra managed service; no Indian region |
| Postgres + Qdrant (self-hosted) | Extra infra to run; same consistency problems |
| MongoDB + Atlas Vector Search | No ACID; harder to enforce relational constraints; Atlas not in Indian region |
| Postgres + Weaviate | Same cross-store consistency problem |

## When to revisit

- If a single clinic accumulates >10M embeddings and HNSW query latency exceeds 500ms — then consider a dedicated vector index (Qdrant self-hosted), but keep the FK relationship via artifact IDs.
- If population-level research features are added — add a data warehouse (BigQuery India or ClickHouse) as a read-only analytics layer without changing the operational store.
