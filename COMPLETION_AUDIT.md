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
| First-run demo does not pretend fake students already exist | Clean runtime state starts with no registered students; dashboard registration creates students through `/api/students`, and e2e uses that same path before task/report validation. | PASS |
| Unfinished 자료 라이브러리 is removed from the MVP path | `/teacher/library` redirects to `/teacher/dashboard`, keeping the demo focused on the validated 수업 준비 -> 실행카드 -> 학생 수행 -> 리포트 flow. | PASS |

## Residual External Data Notes

- pgvector is active when run with `pnpm dev:pgvector`; local Docker service and ingestion were verified on 2026-05-30.
- Full NCIC/KICE file-corpus ingestion still requires official source files/API access and licensing terms. The current pgvector corpus includes 5,885 STAS official 2015 revised elementary/middle/high standards metadata rows plus 4 explicit seed rows, and does not silently pretend to be a complete public corpus.

## Ralph Nonstop MVP Reset - 2026-05-31

Objective: strip the product back to one honest, usable teacher-student flow and leave a clean manual-inspection state with one real registered student and one published card.

| Requirement | Evidence | Status |
| --- | --- | --- |
| No confusing mixed setup/dashboard surface | `src/components/next-step-demo.tsx` was replaced with a focused teacher shell: 교실 운영, 수업 준비, 실행카드, 학생 리포트. | PASS |
| School is not a fixed fake label | The final runtime state was created by `/api/neis/schools/search` and `/api/classroom/context`; current school is `서울신용산초등학교`, source `NEIS`. | PASS |
| Student is explicitly registered | E2E resets the DB, then creates `시연학생` through `/api/students`; no preloaded student list is used. | PASS |
| Teacher-created card appears in student UI | E2E creates and publishes `인물의 마음 찾기`, then `/student/task` and `/api/student/tasks/:cardId` load that card by ID. | PASS |
| Student UI is mobile-first | `/student/task` is constrained to a phone-sized shell on desktop and full-width on mobile; browser smoke found no console errors. | PASS |
| AI card no longer gets overwritten into a fixed visual sample | The deterministic `specializeVisualHints` post-processing was removed from `/api/execution-cards/generate`; validated LLM schema output is persisted directly. | PASS |
| Voice API is actually reachable from UI | Student help sentence card has `도움 문장 듣기`, which calls `/api/voice/tts` and surfaces real ElevenLabs errors if unavailable. | PASS |
| Logs update report | E2E writes confused/simplify/help-sentence/quiz/complete logs and verifies `helpRequestCount: 3`, `completionRate: 33`. | PASS |
| Runtime left inspectable | `data/app-db.json` now contains one NEIS school, one class, one student, one lesson, one published card, six logs, one summary, and one report. | PASS |
| Verification commands | `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm e2e`, `pnpm pgvector:status`, `pnpm corpus:audit` all passed. | PASS |

Remaining honest limits:

- The app can claim STAS official metadata RAG is embedded and searchable, not a complete NCIC/KICE full-text corpus.
- Dynamic learning diagrams are rendered by SVG/CSS from `visualHint`; per-lesson generated image assets are not forced when a deterministic visual is clearer and cheaper.
- ElevenLabs audio is wired to the UI, but it requires valid `ELEVENLABS_API_KEY` and voice configuration at runtime.
