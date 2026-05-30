# 다음한걸음

느린학습자 지원 교육 서비스 “다음한걸음”의 실행 가능한 MVP 웹앱입니다. 랜딩 페이지가 아니라 교사용 대시보드, 수업 준비, 실행카드 편집, 학생 과제 수행, 복구노트, 학생 리포트 흐름을 실제 API와 저장소에 연결해 동작시킵니다.

## 실행

```bash
pnpm install
pnpm seed
pnpm dev
```

브라우저에서 다음 경로를 엽니다.

- 교사: http://localhost:3000/teacher/dashboard
- 학생: http://localhost:3000/student/task

이미 3000번 포트를 다른 앱이 쓰고 있다면 아래처럼 실행합니다.

```bash
pnpm dev --port 3001
```

- 교사: http://localhost:3001/teacher/dashboard
- 학생: http://localhost:3001/student/task

pgvector RAG 백엔드를 쓰려면 로컬 pgvector Postgres를 먼저 띄우고 성취기준을 적재합니다.

```bash
pnpm pgvector:up
pnpm ingest:standards:seed
pnpm collect:stas:standards:all
pnpm ingest:standards:official
pnpm corpus:audit
pnpm collect:public:sources
pnpm dev:pgvector
```

- pgvector 상태: http://localhost:3001/api/health/pgvector
- 예시 env: `.env.pgvector.example`
- 앱은 `RAG_VECTOR_BACKEND=pgvector` 또는 PostgreSQL `DATABASE_URL`이 설정된 경우 pgvector를 사용합니다. 연결/extension/embedding 실패 시 로컬 더미로 대체하지 않고 오류를 반환합니다.
- `sourceType=seed`와 `sourceType=official`을 분리해서 저장합니다. 현재 공식 자료 corpus는 STAS 2015 개정 초/중/고 성취기준 공개 자료 5,885개이며, NCIC/KICE 전체 원문 corpus라고 포장하지 않습니다.

## 주요 기능

- 교사 대시보드, 수업 준비, 실행카드 편집, 학생 리포트
- 교실 운영 설정: NEIS 학교 검색/연결, 학급 설정, 학생 등록
- 학생 모바일 과제 수행, 모르겠어요, 다시 쉽게 말해줘, 확인 퀴즈, 복구노트
- 파일 DB 기반 저장: `data/app-db.json`
- NEIS 학교 검색, 시간표, 학사일정 실제 API adapter
- OpenAI embedding 기반 RAG 검색: 기본은 명시적 로컬 vector store, `dev:pgvector`에서는 PostgreSQL `pgvector` similarity search
- 추천 성취기준 출처 표시: 성취기준 코드, 출처명, sourceType, sourceUrl, license/이용조건 메모
- 실행카드 생성 응답의 `ragTrace`: 선택 성취기준, 검색된 공식 자료, prompt field presence를 key 없이 검증
- `supportOptions` canonical key 적용: `easy_language`, `step_breakdown`, `visual_hint`, `repeat_check`, `help_sentence`, `life_example`
- OpenAI JSON schema 기반 실행카드 생성
- 학생 유형별 UX 반영: 쉬운 말 카드, stepper 강조, 시각 단서 우선 배치, 반복 퀴즈 강조, 도움 요청 문장 카드, 생활 속 미션
- 실행카드 편집 저장: 단계 추가, 삭제, 순서 변경, 수정이 `PATCH /api/execution-cards/:id`로 영구 반영
- 학생 이벤트 로그 기반 리포트: 모르겠어요, 다시 쉽게 말해줘, 도움 문장 보기, 퀴즈, 완료 로그 반영
- ElevenLabs TTS route 구현, 키/요청/API 실패 시 명시 오류 반환
- gpt-image-2 asset generation script/API 구현 및 `/public/assets/generated` 실제 PNG asset 적용
- 레퍼런스 이미지는 현재 macOS 환경의 `/mnt` read-only 제약 때문에 `reference-images/`에도 보관

## 환경 변수

`.env.local`에 아래 키 이름을 사용할 수 있습니다. API는 값 자체를 출력하지 않고 boolean 상태만 반환합니다.

- `OPENAI_API_KEY`
- `NEIS_API_KEY`
- `PUBLIC_DATA_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `DATABASE_URL`
- `RAG_VECTOR_BACKEND`

## 검증 명령

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm e2e
pnpm e2e:rag
pnpm pgvector:status
pnpm corpus:audit
```

`pnpm e2e`는 실행 중인 로컬 서버(`E2E_BASE_URL`, 기본 `http://localhost:3001`)를 대상으로 “teacher creates card, edits steps, publishes, student completes, report updates” 플로우를 실제 API로 검증합니다.

## 관련 문서

- [API_STRUCTURE.md](./API_STRUCTURE.md)
- [DATA_SOURCES.md](./DATA_SOURCES.md)
- [DATA_REQUIRED.md](./DATA_REQUIRED.md)
- [DEMO_FLOW.md](./DEMO_FLOW.md)
- [QA_REPORT.md](./QA_REPORT.md)
- [COMPLETION_AUDIT.md](./COMPLETION_AUDIT.md)
- [REFERENCE_IMAGES.md](./REFERENCE_IMAGES.md)
