# Data Sources

Verified on 2026-05-29 from official public pages and live NEIS hub calls. pgvector and corpus provenance were enabled and verified locally on 2026-05-30. Secret values were not printed or inspected.

## NEIS Open API

- Source: 나이스 교육정보 개방 포털
- Official portal: https://open.neis.go.kr/
- API intro: https://open.neis.go.kr/portal/guide/apiIntroPage.do
- Developer guide: https://open.neis.go.kr/portal/guide/apiGuidePage.do
- Implemented endpoints:
  - `schoolInfo`
  - `SchoolSchedule`
  - `elsTimetable`
  - `misTimetable`
  - `hisTimetable`
  - `spsTimetable`
- Auth: `NEIS_API_KEY`
- Notes: the official developer guide says Open API use requires an issued API key. The live hub also returned public rows without a key during verification. The adapter sends `NEIS_API_KEY` when configured; if NEIS rejects that request at the upstream layer, it retries the same real NEIS endpoint without `KEY` and reports `auth.retriedWithoutKey: true`.

Verified live calls:

```txt
GET https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=1&SCHUL_NM=서울
Result: INFO-000, school rows returned.

GET https://open.neis.go.kr/hub/SchoolSchedule?Type=json&pIndex=1&pSize=1&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010057&AA_FROM_YMD=20260501&AA_TO_YMD=20260531
Result: INFO-000, 가락고등학교 May 2026 schedule rows returned.

GET https://open.neis.go.kr/hub/hisTimetable?Type=json&pIndex=1&pSize=1&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010057&ALL_TI_YMD=20260501
Result: INFO-200 for the tested grade/class query in the local adapter, meaning NEIS responded successfully but had no matching timetable row for that input. The adapter surfaces this as an empty real result, not dummy timetable data.
```

## STAS Achievement Standards Metadata

- Data name: 학생평가지원포털 성취기준 공개 목록
- Provider: KICE / 학생평가지원포털(STAS), Ministry of Education and 시도교육청 공동 서비스
- Source URLs: `https://stas.moe.go.kr/acvmt/acvmtStd/acvmtStdList:s1`, `:s2`, `:s3`
- Public REST endpoint used: `https://stas.moe.go.kr/rest/acvmt/acvmtStd/acvmtStdList?sSchlClsCd={s1|s2|s3}&page=0&size=200&sEduCurclmCd=2015`
- Data type: JSON REST metadata
- Current implementation:
  - Collector: `pnpm collect:stas:standards:all`
  - Processed file: `data/processed/stas-standards-all.json`
  - Ingest: `pnpm ingest:standards:official`
  - pgvector rows: 5,885 with `source_type=official`
- Fields collected: achievement standard sequence, code, text, curriculum name, school level, grade group, course, subject, domain, assessment task counts.
- License / terms: official portal public metadata; detailed reuse/redistribution terms need STAS and KICE/Ministry terms review. Each row stores this caveat in `license`.
- Collection status: implemented for elementary (`s1`), middle (`s2`), and high (`s3`) 2015 revised standards metadata.
- Limitation: this is official metadata/standard text from STAS, not a complete NCIC/KICE full-text corpus with all achievement levels, remediation materials, and assessment files.

## Public Education Source Candidate Metadata

- Collector: `pnpm collect:public:sources`
- Processed file: `data/processed/public-education-source-candidates.json`
- Records collected: 7 source candidates.
- Purpose: widen the public-data pipeline without embedding restricted or license-unclear originals.
- Current result:
  - `stas-achievement-standards-rest-2015`: implemented and embeddable as public official metadata.
  - `stas-user-guide`: metadata only; public PDF status verified, but original PDF text is not embedded before reuse terms are reviewed.
  - `ncic-main`: source discovery only; file-level license parser still required.
  - `ncic-copyright-policy`: license gate metadata only.
  - `stas-login-materials`: login/teacher-member materials are not collected or embedded.
  - `kogl-type-guide`: license reference candidate; local probe failed in this environment, so no ingest.
  - `basics-remediation-portal`: remediation-material candidate; local probe failed or remained license-unclear, so no ingest.

## NCIC Curriculum Resources

- Source: NCIC 국가교육과정정보센터
- URL: https://ncic.re.kr/
- Dataset usage: source discovery and copyright/terms reference. The bundled NCIC-labeled row is `sourceType=seed`, not an embedded official NCIC full corpus row.
- Search implementation:
  - Default: OpenAI embedding vector search over the explicit local vector store.
  - pgvector mode: local Docker Postgres `pgvector/pgvector:pg16`, `vector` extension `0.8.2`, table `standards_vector_chunks`, `embedding vector(1536)`, cosine distance query via `embedding <=> $query::vector`.
  - Activation: `pnpm pgvector:up`, `pnpm ingest:standards:seed`, `pnpm ingest:standards:official`, `pnpm dev:pgvector`.
- Verified records:
  - `국어 성취기준`, `2022 개정`, `초등학교(2022.12)`
  - `수학 성취기준`, `2022 개정`, `초등학교(2022.12)`
  - `영어 성취기준`, `2022 개정`, `중학교(2022.12)`
  - `공통수학1 성취기준`, `2022 개정`, `고등학교(2022.12)`

Verified pgvector state:

```txt
container: daeum_pgvector
database: daeum_hangeoreum
extension: vector 0.8.2
table: standards_vector_chunks
rows: 5889
source counts: official 5885, seed 4
embedding dimensions: 1536
query verified: 국어 인물의 마음 -> STAS official Korean rows; 직사각형 둘레 -> STAS official math rows plus seed when explicitly filtered
```

- Copyright policy page: https://ncic.re.kr/mbr/policy.do
- Observed copyright note: NCIC states KICE-owned works with KOGL Type 2 marks may be freely used under the attached KOGL terms, while non-KOGL materials require checking/consultation.
- Automation status: list/detail/download scraping appears possible for some boards, but full official corpus ingestion still needs robust page/file parsing and per-file license preservation.

## Other Investigated Sources

- NCIC 성취수준 board: https://ncic.re.kr/bbs/standard/list.do
  - Type: HTML board and downloadable files.
  - Status: discovered; detail/file crawling still needs robust browser-like collection and license capture.
- KICE data portal: https://data.kice.re.kr/home
  - Type: education data portal app/API candidate.
  - Status: discovered; endpoint inspection still needed. No source text embedded.
- KICE / data.go.kr research report list: https://www.data.go.kr/data/15098907/fileData.do
  - Type: public CSV/OpenAPI metadata.
  - Status: good candidate for KICE report metadata; not direct achievement standards.
- 국가기초학력지원포털 / 꾸꾸: https://www.basics.re.kr/
  - Type: remediation/support materials site.
  - Status: candidate metadata recorded; automated access or license status was not reliable enough to ingest. 원문 embedding 보류.

## Ministry of Education Curriculum Release

- Source: 교육부
- URL: https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=93459&lev=0&searchType=null&statusY=
- Dataset usage: official release metadata for the 2022 revised elementary, secondary, and special education curriculum.
- Verified page date: 2022-12-22.
