# QA Report - 다음한걸음 Demo

Date: 2026-05-30
Workspace: `/Users/gimdonghyeon/Desktop/live2d/nnnnnrrrrrin`
Target: final local dev server available at `http://localhost:3001`

Update: pgvector backend, provenance schema, and STAS official metadata ingestion were locally verified on 2026-05-30. The current pgvector corpus has 5,885 STAS official rows plus 4 explicit seed rows.
Final MVP update: canonical support options, standard provenance persistence, `review.homeMission`, student support-profile UI, and RAG generation diversity were re-verified on 2026-05-30.

## Summary

Overall status: PASS.

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS
- `pnpm e2e`: PASS for `teacher creates card, edits steps, publishes, student completes, report updates`
- `pnpm e2e:rag`: PASS for official metadata search, RAG trace, and generation diversity
- `pnpm pgvector:up`: PASS
- `pnpm collect:stas:standards:all`: PASS
- `pnpm collect:public:sources`: PASS
- `pnpm ingest:standards:seed`: PASS
- `pnpm ingest:standards:official`: PASS
- `pnpm pgvector:status`: PASS
- `pnpm corpus:audit`: PASS
- Local API health: PASS
- NEIS live school/timetable/schedule calls: PASS
- Standards search: PASS, including pgvector similarity search, sourceType filtering, provenance fields, and flexible grade-band match such as `초4` -> `3-5`
- Execution card generation: PASS using persisted lesson input, final schema, retrieved RAG context, selected standard provenance, canonical support options, and non-secret `ragTrace`
- Execution-card PATCH persistence: PASS for step edit, reorder, delete, and add
- Student task events and report aggregation: PASS, including `help_sentence_viewed`
- Student support UI: PASS for easy-language keyword card, step-focused progress, visual-hint priority, help-sentence card, repeat-check quiz style, and life mission rendering
- Invalid student event validation: PASS with HTTP 404
- Browser UI smoke test: PASS on teacher route navigation, execution-card editing, report table toggle, student task, and student review navigation
- Generated assets: PASS. `gpt-image-2` produced logo, student mascot, help robot, and math card icon PNGs with manifest status `generated`.

## Commands

### Static checks

```bash
pnpm typecheck
```

Result: PASS. `tsc --noEmit` exited 0.

```bash
pnpm lint
```

Result: PASS. `eslint .` exited 0.

```bash
pnpm build
```

Result: PASS. Next.js 15.5.18 compiled successfully, linted/type-checked during build, generated 39 static pages, and listed all expected dynamic API routes.

### E2E

```bash
E2E_BASE_URL=http://localhost:3001 pnpm e2e
```

Result: PASS against production server on port 3001. Output included `cardId: card_mpr9us7s_f5bjd3`, `lessonId: lesson_mpr9udnm_016awk`, `helpRequestCount: 3`, `completionRate: 25`.

```bash
E2E_BASE_URL=http://localhost:3001 pnpm e2e:rag
```

Result: PASS. Verified four topics (`직사각형의 둘레`, `인물의 마음 찾기`, `식물의 한살이`, `분수의 덧셈`), official metadata provenance, `review.homeMission`, and visual hint diversity: `number_line`, `rectangle_dimension`, `sequence_checklist`.

### Browser smoke

Result: PASS after restarting the dev server post-build. `/student/task` rendered generated student support UI and `/teacher/lessons/new` rendered official metadata source badges. Console showed only Next.js development Fast Refresh/React DevTools notices, no runtime errors.

### Health

```bash
curl -i http://localhost:3001/api/health
```

Result: PASS. HTTP 200 with `ok: true`. Environment status reported configured keys for `OPENAI_API_KEY`, `NEIS_API_KEY`, `PUBLIC_DATA_API_KEY`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID`.

## API Verification

### NEIS live calls

School search:

```bash
curl 'http://localhost:3000/api/neis/schools?keyword=%EA%B0%80%EB%9D%BD&pageSize=5'
```

Result: PASS. Returned `ok: true`, `totalCount: 6`, including `서울가락초등학교` with `officeCode: B10`, `schoolCode: 7130102`.

Timetable:

```bash
curl 'http://localhost:3000/api/neis/timetable?kind=els&officeCode=B10&schoolCode=7130102&date=20260529&grade=4&className=1&pageSize=5'
```

Result: PASS. Returned `ok: true`, `totalCount: 5`, with 2026-05-29 periods including 수학, 사회, 미술, 과학.

Schedule:

```bash
curl 'http://localhost:3000/api/neis/schedule?officeCode=B10&schoolCode=7130102&from=20260501&to=20260531&pageSize=5'
```

Result: PASS. Returned `ok: true`, `totalCount: 12`, including May 2026 school events such as 노동절 and 자율휴업일.

### Standards search

```bash
curl 'http://localhost:3000/api/standards/search?q=%EC%A7%81%EC%82%AC%EA%B0%81%ED%98%95%20%EB%91%98%EB%A0%88&subject=%EC%88%98%ED%95%99&gradeBand=%EC%B4%884&limit=3'
```

Result: PASS. Returned STAS official math rows with `sourceType: official`, `standardCode`, `sourceName`, `sourceUrl`, `license`, and scores. Seed rows remain available only as explicit `sourceType=seed` demo corpus.

Provenance search:

```bash
curl 'http://localhost:3001/api/standards/search?q=%EC%93%B0%EA%B8%B0&sourceType=official&limit=2'
```

Result: PASS. Returned STAS official rows with `standardCode`, `sourceType: official`, `sourceName`, `sourceUrl`, `license`, and scores.

Multi-query official metadata probes:

```txt
직사각형 둘레 -> official STAS math rows
인물의 마음 -> official STAS Korean rows
식물의 한살이 -> official STAS science rows
분수 덧셈 -> official STAS math rows
길이 단위 -> official STAS math measurement rows
```

### pgvector backend

```bash
pnpm pgvector:up
pnpm ingest:standards:seed
pnpm collect:stas:standards:all
pnpm ingest:standards:official
pnpm pgvector:status
pnpm corpus:audit
```

Result: PASS. Docker container `daeum_pgvector` is healthy on port `5433`; PostgreSQL extension `vector` version `0.8.2` is installed; table `standards_vector_chunks` contains 5,889 chunks with `vector_dims(embedding)=1536`.

Source counts:

```json
{
  "official": 5885,
  "seed": 4
}
```

Direct similarity probe:

```bash
DATABASE_URL=postgresql://daeum:daeum@127.0.0.1:5433/daeum_hangeoreum RAG_VECTOR_BACKEND=pgvector pnpm exec tsx -e "..."
```

Result: PASS. Query `국어 인물의 마음` returned STAS official Korean rows first, including `[4국05-02]` and `[4국03-04]`.

### Public source-candidate metadata

```bash
pnpm collect:public:sources
```

Result: PASS. Wrote `data/processed/public-education-source-candidates.json` with 7 source candidates. Only STAS achievement-standard REST is marked `embeddableNow: true`; NCIC, STAS PDF/manual, login-only STAS materials, KOGl reference, and basics portal candidates remain metadata-only, license-review, or login/file-required.

### Execution cards

List:

```bash
curl 'http://localhost:3000/api/execution-cards'
```

Result: PASS. Returned two cards, both published: `card_rectangle_perimeter` and `card_mpqjbvly_p8a8k4`.

Generation:

```bash
curl -X POST 'http://localhost:3000/api/execution-cards/generate' \
  -H 'content-type: application/json' \
  --data '{"subject":"수학","gradeBand":"초4","topic":"직사각형의 둘레","objectives":["직사각형의 둘레를 구하는 식을 설명한다"],"save":false}'
```

Result: PASS. Returned generated card `직사각형의 둘레 구하기` with subject `수학`, grade band `초4`, 3 steps, and 1 matched resource. Used `save:false` to avoid adding another generated card.

### Student events

Task list:

```bash
curl 'http://localhost:3000/api/student/tasks'
```

Result: PASS. Current flow returns a registered student id such as `student_a` with the latest published task. Historical hardcoded student/task ids are no longer required for the live UI.

Start event:

```bash
curl -i -X POST 'http://localhost:3000/api/student/tasks/card_mpqjbvly_p8a8k4/steps/step_mpqjbvly_a8awog/start'
```

Result: PASS. HTTP 200 with log event `started`.

Complete event:

```bash
curl -X POST 'http://localhost:3000/api/student/tasks/card_mpqjbvly_p8a8k4/steps/step_mpqjbvly_dq0f80/complete'
```

Result: PASS. Returned log event `completed` and recomputed summary with `completionRate: 33`, `helpRequestCount: 0`, `totalQuizCount: 0`.

Validation guard:

```bash
curl -i -X POST 'http://localhost:3001/api/student/tasks/not-a-card/steps/not-a-step/start'
```

Result: PASS. HTTP 404 with JSON error `배포된 과제를 찾을 수 없습니다.`. Student event APIs now validate that the card is published and that the step belongs to the card before writing a log.

Concurrent student event probe:

Result: PASS. Parallel `start`, `confused`, `simplify`, `complete`, and `quiz` calls against `card_rectangle_perimeter/step_1` all returned HTTP 200 JSON after the JSON file store write queue and validation fixes.

### Report aggregation

```bash
curl 'http://localhost:3000/api/reports/cards/card_mpqjbvly_p8a8k4'
```

Result: PASS. Returned log-based report data for the selected registered student, including `completionRate: 33` and per-step entries.

## Browser UI Verification

Teacher dashboard:

- Route: `http://localhost:3001/teacher/dashboard`
- Result: PASS. Browser DOM contained `오늘의 수업 준비`, `학생 진행 현황`, and dashboard navigation. Console error count: 0.

Teacher route/actions:

- Route movement: PASS. Sidebar `수업 준비` moved to `/teacher/lessons/new`; `실행카드` opens the active card editor when a card exists; `학생 리포트` opens the selected registered student's report.
- Lesson prep actions: PASS. `자세히 보기` expanded the preview content.
- Execution-card edit actions: PASS. `순서 변경` reordered the first two steps; `삭제`, `단계 추가`, `저장`, `학생에게 배포`, and `다시 생성` have concrete handlers. The right-side student preview rendered without the previous rectangle-label overlap.
- Report actions: PASS. `표 보기` toggled the chart into rows; report row/recommendation buttons route to the relevant app views; parent memo copy and report download handlers are wired.

Student task:

- Route: `http://localhost:3001/student/task`
- Result: PASS. Browser DOM contained `완료했어요`, `모르겠어요`, `다시 쉽게 말해줘`, and quiz choices. Browser clicks posted task events, updated the help count, selected a quiz answer, advanced from step 3 to step 4, and then completed into `/student/tasks/card_rectangle_perimeter/review`.
- Regression check: PASS. `다시 쉽게 말해줘` state resets when switching steps, so the easier text no longer leaks into the next step.

Student review/preview:

- Route: `http://localhost:3001/student/tasks/card_rectangle_perimeter/review`
- Result: PASS. Review displayed completion `4/4`, generated good points, next review buttons, and `복습 카드 보기` moved to `/student/preview`.

Reference images:

- `/mnt/data` could not be created in this local macOS workspace because `/mnt` is mounted read-only. The provided source images were copied to `reference-images/` with the requested Korean filenames plus the existing numbered filenames for stable comparison.

## Residual Notes

- The workspace is not a git repository, so QA could not use git status to distinguish pre-existing file changes.
- Student event and report aggregation routes are stateful. The API verification added demo log/report state through the local app server.
- Port `3000` is occupied by another local Next.js process on this machine, so the final demo server was started on `3001` to avoid ambiguity.
- Full official NCIC/KICE file corpus ingestion is documented as a data requirement in `DATA_REQUIRED.md`; the current corpus includes STAS official 2015 revised elementary/middle/high standards metadata plus explicit demo seed rows, not the full NCIC/KICE file corpus.
- pgvector is active when the app is started with `pnpm dev:pgvector`. The default `pnpm dev` path still uses the explicit local vector store for environments where Docker/PostgreSQL is not running; it does not silently pretend to be pgvector.

## Latest E2E Flow - 2026-05-30

Command:

```bash
E2E_BASE_URL=http://localhost:3001 pnpm e2e
```

Result: PASS against the `pnpm dev:pgvector` server.

Verified scenario:

1. Search standards with RAG for `국어 인물의 마음`.
2. Assert search result provenance fields: `sourceType`, `sourceName`, `license`.
3. Search with `sourceType=official` and assert an official STAS row with `standardCode` and source URL.
4. Create a lesson with full teacher payload: school/class/subject/grade/date/topic/content/assignment/standard/support options.
5. Generate an AI execution card from that persisted lesson and RAG context, preserving selected standard code/source URL and returning `ragTrace.promptFields`.
6. Edit generated steps: reorder, delete one original step, add a new step, and change step text.
7. Save and reload the card, confirming edited steps persisted.
8. Publish the card.
9. Load the student task by URL `cardId`.
10. Write `started`, `confused`, `simplify`, `help_sentence_viewed`, `quiz_answered`, and `completed` logs.
11. Read the teacher report and confirm `helpRequestCount: 3`, per-step rows, and completion summary changed from logs.

Last passing run output:

```json
{
  "ok": true,
  "testName": "teacher creates card, edits steps, publishes, student completes, report updates",
  "cardId": "card_mpr7u7h7_gnz3o5",
  "lessonId": "lesson_mpr7txjh_xjij3d",
  "helpRequestCount": 3,
  "completionRate": 33
}
```

## Latest RAG Diversity Flow - 2026-05-30

Command:

```bash
E2E_BASE_URL=http://localhost:3001 pnpm e2e:rag
```

Result: PASS.

Verified:

1. Official metadata search for 수학 `직사각형의 둘레`.
2. Official metadata search for 국어 `인물의 마음 찾기`.
3. Official metadata search for 과학 `식물의 한살이`.
4. Official metadata search for 수학 `분수의 덧셈`.
5. `save:false` execution-card generation for each case.
6. `ragTrace` includes `retrievedStandards`, selected standard, sourceType/sourceName/sourceUrl/license.
7. Generated visual hints vary by topic: `rectangle_dimension`, `sequence_checklist`, `number_line`.

Last passing run output:

```json
{
  "ok": true,
  "cases": [
    "직사각형의 둘레",
    "인물의 마음 찾기",
    "식물의 한살이",
    "분수의 덧셈"
  ],
  "visualHintTypes": [
    "number_line",
    "rectangle_dimension",
    "sequence_checklist"
  ]
}
```

## School And Student Setup Fix - 2026-05-30

Commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
E2E_BASE_URL=http://localhost:3001 pnpm e2e
E2E_BASE_URL=http://localhost:3001 pnpm e2e:rag
pnpm pgvector:status
pnpm corpus:audit
```

Result: PASS.

Additional manual/browser verification:

1. `/teacher/dashboard` no longer starts with a fake fixed school name. It shows `학교 연결 전` until a school is connected.
2. Dashboard has `시연 시작 설정` with NEIS school search, grade/class selection, and student registration.
3. NEIS search/connection was verified with `서울신용산초등학교`; `/api/classroom/context` persisted `source: NEIS`, school code, office code, and `4학년 2반`.
4. Student registration was verified through `/api/students` by adding `시연 학생 D` with a support profile.
5. `/student/task` loads the latest published card generated by the teacher flow and exposes a registered-student selector.
6. `/teacher/reports/student_a` reflects the student logs from e2e: help request count `3`, completion rate `33%`, and per-step report data.

Latest passing outputs:

```json
{
  "e2e": {
    "ok": true,
    "cardId": "card_mps2q98z_15p3wq",
    "lessonId": "lesson_mps2pz8i_z4s25a",
    "helpRequestCount": 3,
    "completionRate": 33
  },
  "pgvector": {
    "ok": true,
    "chunks": 5889,
    "bySourceType": {
      "official": 5885,
      "seed": 4
    }
  }
}
```

## Presentation Readiness Polish - 2026-05-30

Commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
E2E_BASE_URL=http://localhost:3001 pnpm e2e
E2E_BASE_URL=http://localhost:3001 pnpm e2e:rag
pnpm pgvector:status
```

Result: PASS.

Fixes verified:

1. E2E no longer leaves random suffixes such as `mps...` or test-only text like `저장 확인` in user-visible lesson/card titles.
2. Teacher snapshot now uses the active card's lesson rather than the first inserted lesson, so 수업 준비/대시보드/편집 화면 stay aligned with the latest published card.
3. Narrow-width screenshots no longer break support option buttons, report recommendation rows, execution-card edit rows, or student help-sentence cards into unreadable vertical text.
4. Student task screen renders the generated card title and generated help sentence cleanly.
5. In-app browser screenshots captured for review:
   - `/tmp/daeum-review-screenshots-ready/01_teacher_dashboard.png`
   - `/tmp/daeum-review-screenshots-ready/02_lesson_prep.png`
   - `/tmp/daeum-review-screenshots-ready/03_card_edit.png`
   - `/tmp/daeum-review-screenshots-ready/04_student_task.png`
   - `/tmp/daeum-review-screenshots-ready/05_teacher_report.png`

Latest passing outputs:

```json
{
  "e2e": {
    "ok": true,
    "cardId": "card_mps8ulq0_8wn7x1",
    "lessonId": "lesson_mps8uced_v560k9",
    "helpRequestCount": 3,
    "completionRate": 25
  },
  "e2eRag": {
    "ok": true,
    "cases": [
      "직사각형의 둘레",
      "인물의 마음 찾기",
      "식물의 한살이",
      "분수의 덧셈"
    ],
    "visualHintTypes": [
      "number_line",
      "rectangle_dimension",
      "sequence_checklist"
    ]
  },
  "pgvector": {
    "ok": true,
    "chunks": 5889,
    "bySourceType": {
      "official": 5885,
      "seed": 4
    }
  }
}
```
