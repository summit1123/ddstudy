# API Structure

## Health / Env

- `GET /api/health`
- `GET /api/health/env`
- `GET /api/health/pgvector`

키 값은 출력하지 않고 key name과 configured boolean만 반환합니다.

## NEIS

- `GET /api/neis/schools/search?keyword=`
- `GET /api/neis/schools?keyword=`
- `GET /api/neis/timetable?schoolCode=&officeCode=&date=&grade=&classNo=&kind=`
- `GET /api/neis/schedule?schoolCode=&officeCode=&from=&to=`

`kind`는 `els`, `mis`, `his`, `sps` 중 하나입니다.

## Public Data / RAG

- `POST /api/ingest/standards`
- `POST /api/standards/ingest`
- `GET /api/standards/search?q=&subject=&gradeBand=&sourceType=`
- `GET /api/resources/search?q=&subject=&gradeBand=`
- `GET /api/resources`
- `POST /api/ingest/resources`

Standards search는 OpenAI embeddings 기반입니다. 기본 모드는 명시적 로컬 vector store이며, `RAG_VECTOR_BACKEND=pgvector` 또는 PostgreSQL `DATABASE_URL`이 설정되면 PostgreSQL `pgvector` 테이블 `standards_vector_chunks`에 `vector(1536)` embedding을 저장하고 `embedding <=> query_embedding`으로 similarity search를 수행합니다. API 실패 시 임시 결과를 반환하지 않습니다.

Search response provenance fields:

- `standardCode`
- `sourceType`: `seed | official | crawled | uploaded | manual`
- `sourceName`
- `sourceUrl`
- `license`
- `chunkType`

기본 정렬은 `official`, `crawled`, `uploaded`, `manual`, `seed` 순으로 우선순위를 둔 뒤 vector distance를 적용합니다. `sourceType=official`처럼 명시 필터도 사용할 수 있습니다.

## Lesson Prep

- `GET /api/lessons`
- `POST /api/lessons`
- `GET /api/lessons/:id`
- `PATCH /api/lessons/:id`
- `POST /api/lessons/:id/preview`
- `POST /api/lessons/:id/publish`

## Execution Card

- `GET /api/execution-cards`
- `POST /api/execution-cards`
- `POST /api/execution-cards/generate`
- `GET /api/execution-cards/:id`
- `PATCH /api/execution-cards/:id`
- `POST /api/execution-cards/:id/publish`

Generation uses OpenAI JSON schema mode and local zod validation before saving. `PATCH /api/execution-cards/:id` persists the card body and the complete `steps` array, including add/delete/reorder/edit operations.

## Student

- `GET /api/student/tasks`
- `GET /api/student/tasks/:cardId`
- `POST /api/student/tasks/:cardId/steps/:stepId/start`
- `POST /api/student/tasks/:cardId/steps/:stepId/complete`
- `POST /api/student/tasks/:cardId/steps/:stepId/confused`
- `POST /api/student/tasks/:cardId/steps/:stepId/simplify`
- `POST /api/student/tasks/:cardId/steps/:stepId/help-sentence`
- `POST /api/student/tasks/:cardId/steps/:stepId/quiz`
- `GET /api/student/tasks/:cardId/review`
- `POST /api/student/tasks/:cardId/review`

All student actions append `StudentStepLog` records and refresh summary/report data.

## Reports

- `GET /api/reports/students/:studentId`
- `GET /api/reports/cards/:cardId`
- `POST /api/reports/generate`

## Teacher Assistant

- `POST /api/teacher/assistant`

Body:

```json
{
  "studentId": "student_id",
  "cardId": "optional_published_card_id",
  "question": "학생 지원에 대해 선생님이 묻는 질문"
}
```

The endpoint reads the registered student profile, support options, active execution card, lesson, task summary, per-step log evidence, and report recommendations, then calls OpenAI JSON schema generation. If OpenAI or required data fails, it returns an explicit API error instead of a fake chatbot answer.

## Assets / Voice

- `GET /api/assets`
- `POST /api/assets/generate`
- `POST /api/voice`
- `POST /api/voice/tts`

Asset generation hard-requires `gpt-image-2`. Voice synthesis calls ElevenLabs only when required keys and request text are present.
