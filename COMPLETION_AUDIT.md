# Completion Audit - 다음한걸음 Core Flow

Date: 2026-05-30
Objective: 교사 수업 준비 입력 -> 성취기준 검색/RAG -> AI 실행카드 생성 -> 교사 편집/저장/배포 -> 학생 수행/로그 저장 -> 교사 리포트 반영

## Prompt-to-Artifact Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Teacher lesson-prep input is captured and persisted | `TeacherPrep` sends school/class/grade/classNo/subject/date/topic/content/instruction/standard/support options; `/api/lessons` saves the lesson. Covered by `pnpm e2e`. | PASS |
| Standards search / RAG returns real search results | `/api/standards/search` uses OpenAI embeddings over the vector store. pgvector mode stores embeddings in PostgreSQL `standards_vector_chunks.embedding vector(1536)` and searches with `embedding <=> query`. E2E verifies `국어 인물의 마음` returns a result. | PASS |
| AI execution card generation uses lesson + RAG context | `/api/execution-cards/generate` uses final schema, persisted `lessonId`, selected standard provenance, lesson content, assignment instruction, canonical support options, and retrieved official metadata. E2E generates non-math Korean reading and multi-subject cards. | PASS |
| Student support profiles affect output/UI | `supportOptions` are normalized to canonical keys. Student UI shows easy-language keyword cards, stepper emphasis, visual-hint priority, repeat-check quiz styling, help-sentence cards, and `review.homeMission` for life examples. Covered by browser smoke and `pnpm e2e:rag`. | PASS |
| Teacher edit/save/publish persists steps | `PATCH /api/execution-cards/:id` replaces the complete step set while preserving IDs where possible; E2E edits, reorders, deletes, adds, reloads, and publishes. | PASS |
| Student task loads by URL cardId | `/student/tasks/[cardId]` passes `cardId`; `/api/student/tasks/:cardId` returns that card bundle. E2E asserts URL cardId is honored. | PASS |
| Student actions save logs | Start, complete, confused, simplify, help-sentence, and quiz routes append `StudentStepLog` records. E2E writes all event types. | PASS |
| Review/report reflect logs | `buildTaskSummary` and `buildStudentReport` compute completion, help count, stuck steps, per-step rows, recommendations, and parent memo from logs. E2E confirms `helpRequestCount: 3` and per-step rows. | PASS |
| UI no longer embeds forbidden data strings in components | `rg` over `src/components`, `src/app`, and `src/lib` excluding seed/RAG files found no forbidden fixed UI strings. | PASS |
| Validation gates pass | `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm e2e`, `pnpm e2e:rag`, `pnpm pgvector:status`, and `pnpm corpus:audit` pass. | PASS |

## Residual External Data Notes

- pgvector is active when run with `pnpm dev:pgvector`; local Docker service and ingestion were verified on 2026-05-30.
- Full NCIC/KICE file-corpus ingestion still requires official source files/API access and licensing terms. The current pgvector corpus includes 5,885 STAS official 2015 revised elementary/middle/high standards metadata rows plus 4 explicit seed rows, and does not silently pretend to be a complete public corpus.
