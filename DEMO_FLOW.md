# Demo Flow

1. Open `/teacher/dashboard`.
2. In `시연 시작 설정`, connect the school/class.
   - Current app supports NEIS school search from this panel.
   - If a school is not connected yet, the UI explicitly shows `학교 연결 전`; it does not pretend that a fake school came from NEIS.
3. Register students in `학생 등록`.
   - The clean demo state does not preload fake students.
   - Students can be added through `POST /api/students` or the dashboard form, and reports/student screens use the registered student IDs.
4. Confirm date, active tasks, support-needed students, and recent cards.
5. Open `수업 준비` or `/teacher/lessons/new`.
6. Use topic `직사각형의 둘레 구하기` or another subject/topic such as `인물의 마음 찾기`.
5. Search standards through `/api/standards/search?q=직사각형 둘레&subject=수학&gradeBand=초4`.
6. Confirm or select an official STAS metadata result. The card shows `공식 메타데이터`, source name, source URL, and license/terms note.
7. Keep support options: 쉬운 말 필요, 단계 쪼개기, 시각 단서, 반복 확인, 도움 요청 문장, 생활 예시. Internally these are saved as canonical keys: `easy_language`, `step_breakdown`, `visual_hint`, `repeat_check`, `help_sentence`, `life_example`.
8. Click `실행카드 생성`; the API calls OpenAI with the selected standard and retrieved RAG context, then stores a draft execution card.
9. Open the card editor, review/edit steps, add/delete if needed.
10. Click `학생에게 배포`; the card status changes to `published`.
11. Open `/student/task`; it loads the latest published execution card, not a hardcoded old problem.
    - Open `/student/tasks/:cardId` to inspect a specific published card by URL.
    - Use the student selector to switch between registered students.
12. Student clicks `모르겠어요`.
13. Student clicks `다시 쉽게 말해줘`.
14. Student answers the micro quiz.
15. Student clicks `완료했어요`.
16. Confirm student support UI: easy-language keyword card, visual hint, emphasized help sentence, repeat-check quiz, and life mission when selected.
17. Open review, or call `POST /api/student/tasks/:cardId/review`.
18. Open `/teacher/reports/:studentId` with the registered student ID from the dashboard or API context.
19. Confirm completion, help counts, stuck-step tags, recommendations, and parent memo.

## Known Demo Notes

- The current clean state starts from a local teacher, a pending school connection, one default class selector, no registered students, and no generated task.
- A student screen with no published task or no registered student shows an explicit empty state instead of a hardcoded old problem.
- `/teacher/library` is intentionally redirected to the dashboard for the MVP so the demo stays focused on 수업 준비 -> 실행카드 -> 학생 수행 -> 리포트.
- NEIS is used for school context, schedule, and timetable, not textbook page lookup.
- Current pgvector corpus uses STAS official 2015 revised achievement-standard metadata plus explicit `sourceType=seed` demo rows.
- NCIC/KICE full-text curriculum files, achievement-level files, remediation materials, and assessment-tool originals are not claimed as collected; they are documented in `DATA_REQUIRED.md` until source files and license terms are confirmed.
- Generation responses include a non-secret `ragTrace` object showing which prompt fields and retrieved official metadata rows were used.
