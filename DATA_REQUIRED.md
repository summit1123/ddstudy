# Data Requirements

No official public pages needed for the bundled `data/public/resources.json` metadata seed were blocked during verification on 2026-05-29.

The previous pgvector environment blocker was resolved on 2026-05-30 by adding a local Docker Postgres service using `pgvector/pgvector:pg16`. The verified local demo connection is `DATABASE_URL=postgresql://daeum:daeum@127.0.0.1:5433/daeum_hangeoreum`; this is a development-only credential in the compose file, not a secret production key.

The current vector corpus now includes:

- 4 explicit demo seed rows with `sourceType=seed`.
- 5,885 STAS 2015 revised elementary/middle/high achievement-standard metadata rows with `sourceType=official`.

This is enough to prove provenance-aware pgvector search against some official public metadata. It is not enough to claim a complete official NCIC/KICE public education corpus.

Additional source-candidate metadata was collected with `pnpm collect:public:sources` into `data/processed/public-education-source-candidates.json`. Only the STAS achievement-standard REST candidate is currently marked `embeddableNow: true`; the other records are metadata-only, require license review, or require login/user-provided files.

Required environment key names:

- `NEIS_API_KEY`: recommended and officially documented for NEIS Open API use. Obtain from the NEIS education information open portal after login/key issuance. During verification, the public hub returned rows without `KEY`; the adapter reports when it has to retry without a configured key.
- `PUBLIC_DATA_API_KEY`: reserved for future Korean public-data portal integrations. It is reported by health status but not required by the current bundled resource dataset.
- `DATABASE_URL`: required for pgvector mode. Local demo default is provided by `docker-compose.pgvector.yml`.
- `RAG_VECTOR_BACKEND`: set to `pgvector` to force pgvector mode. If unset, the app uses the explicit local vector store unless `DATABASE_URL` is a PostgreSQL URL.

Resolved pgvector requirement:

- Implemented: local PostgreSQL with `CREATE EXTENSION vector` permission.
- Implemented for: storing standard embeddings in `standards_vector_chunks.embedding vector(1536)` and running SQL similarity search.
- Verified on 2026-05-30: 5,889 chunks ingested, `vector_dims(embedding)=1536`, source counts `official=5,885`, `seed=4`.
- Remaining production action: provide the production PostgreSQL/pgvector URL and migration policy before deploying outside the local demo.

For expanded ingestion beyond the included metadata seed, provide:

- Official source URL or file URL.
- Redistribution/license terms for each file or page, including 공공누리 type where applicable.
- Required API key name, quota limits, and request examples.
- Target schema fields and whether original text can be stored or only linked as metadata.
- NCIC official curriculum source files/API, preferably XLSX/CSV/HTML export/HWPX/PDF with clear KOGL/license markings.
- Achievement-level/minimum-achievement-level files for each subject/grade, preferably HWPX/PDF/XLSX plus page/file source URLs.
- 국가기초학력지원포털/꾸꾸 remediation material metadata files or stable official download pages. Current automated access was not reliable enough to ingest.
- KICE/STAS detailed evaluation and assessment material files or teacher-member session if the public detail pages require permission.
- KICE/data.go.kr API key only if using data.go.kr OpenAPI routes instead of public CSV downloads.

Do not provide or ingest:

- 평가문항 원문 or 평가도구 files unless redistribution and embedding rights are explicit.
- Login-only STAS/KICE/teacher materials unless the user has rights and provides files plus license terms.
- NCIC/KICE/기초학력 원문 files with unclear 공공누리 or copyright markings.
