# HR Platform 근태 API 명세서

- **Base URL**: `/api`
- **대화형 문서**: `/api-docs` (Swagger UI) — OpenAPI 3.1 문서는 `GET /api/openapi`
- **구현**: Next.js App Router Route Handlers (`src/app/api/**`), MongoDB + Mongoose

## 1. 공통 규약

### 응답 형식

모든 응답은 같은 봉투를 쓴다.

```jsonc
// 성공
{ "success": true, "data": { /* 엔드포인트별 */ } }

// 실패
{ "success": false, "error": { "code": "POLICY_IN_USE", "message": "팀에서 사용 중인 근태 정책은 삭제할 수 없습니다.", "details": [] } }
```

`code` 로 분기하고 `message` 를 그대로 사용자에게 보여줄 수 있다. `details` 는 검증 실패일 때만 온다.

### 인증

`POST /api/auth/login` 이 **httpOnly 쿠키 `hr_session`** 을 내려준다 (HS256 JWT, 유효기간 7일, `SESSION_SECRET` 으로 서명).
이후 모든 요청은 이 쿠키로 인증된다. 토큰에 담긴 역할·소속은 신뢰하지 않고 매 요청마다 DB 에서 다시 읽는다 — 권한 회수와 퇴사 처리가 즉시 반영된다.

### 권한

| 역할 | 정책·팀 관리 | 근태 조회 범위 | 본인 근태 기록 |
| --- | --- | --- | --- |
| `HR_ADMIN` | 전체 | 전체 팀 | 팀에 소속된 경우 가능 |
| `TEAM_MANAGER` | 불가 | `Team.managerIds` 에 등록된 팀 | 가능 |
| `EMPLOYEE` | 불가 | 본인만 | 가능 |

팀 근태 조회 권한의 근거는 역할 이름이 아니라 **`Team.managerIds` 등록 여부**다. 역할이 `TEAM_MANAGER` 라도 등록되지 않은 팀은 볼 수 없다.

### 페이지네이션

목록 엔드포인트는 `page`(1부터), `limit`(기본 20, 최대 100)을 받고 `{ items, total, page, limit }` 을 반환한다. `total` 은 현재 페이지가 아니라 필터 전체 건수다.

### 기간 필터

`from`, `to` 는 `YYYY-MM-DD` 이며 **양끝을 포함**한다. `from > to` 면 400.

## 2. 엔드포인트

| # | Method | Path | 권한 | 설명 |
| --- | --- | --- | --- | --- |
| 1 | GET | `/health` | 공개 | MongoDB 연결 확인 |
| 2 | POST | `/auth/bootstrap` | 공개 | 최초 HR 관리자 생성 (사용자 0명일 때만) |
| 3 | POST | `/auth/login` | 공개 | 로그인, 세션 쿠키 발급 |
| 4 | POST | `/auth/logout` | 공개 | 세션 쿠키 만료 |
| 5 | GET | `/auth/me` | 로그인 | 내 정보 + 소속 팀 + 팀 정책 기준 |
| 6 | GET | `/users` | HR | 구성원 목록 (`teamId`·`role`·`isActive` 필터) |
| 7 | POST | `/users` | HR | 구성원 생성 |
| 8 | GET | `/users/{userId}` | HR | 구성원 상세 |
| 9 | PATCH | `/users/{userId}` | HR | 팀 이동·역할 변경·퇴사 처리·비밀번호 재설정 |
| 10 | GET | `/policies` | HR | 근태 정책 목록 (`type` 필터) |
| 11 | POST | `/policies` | HR | 근태 정책 생성 (고정 / 유연) |
| 12 | GET | `/policies/{policyId}` | HR | 정책 상세 |
| 13 | PATCH | `/policies/{policyId}` | HR | 정책 **이름·설명만** 수정 |
| 14 | DELETE | `/policies/{policyId}` | HR | 정책 삭제 (사용 중이면 409) |
| 15 | GET | `/teams` | HR | 팀 목록 |
| 16 | POST | `/teams` | HR | 팀 생성 |
| 17 | GET | `/teams/{teamId}` | HR·팀관리자·팀원 | 팀 상세 |
| 18 | PATCH | `/teams/{teamId}` | HR | 팀 정보 수정 (`managerIds` 지정 포함) |
| 19 | GET | `/teams/{teamId}/policy` | HR·팀관리자·팀원 | 팀에 적용된 현재 정책 |
| 20 | PUT | `/teams/{teamId}/policy` | HR | 팀 정책 적용·변경 (+ 이력 기록) |
| 21 | GET | `/teams/{teamId}/policy-history` | HR·팀관리자 | 정책 변경 이력 (담당자·시각) |
| 22 | GET | `/teams/{teamId}/attendance` | HR·팀관리자 | 팀원 근태 기록 |
| 23 | GET | `/attendance/today` | 로그인 | 오늘의 내 근태 + 적용 기준 |
| 24 | POST | `/attendance/clock-in` | 로그인 | 출근 기록 |
| 25 | POST | `/attendance/clock-out` | 로그인 | 퇴근 기록 |
| 26 | GET | `/attendance/me` | 로그인 | 내 일별 근태 기록 |
| 27 | GET | `/attendance` | HR | 전체 팀 근태 기록 + 요약 |

## 3. 에러 코드

| HTTP | code | 발생 상황 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 요청 본문·쿼리 형식 오류, 스키마 검증 실패 |
| 400 | `BAD_REQUEST` | JSON 파싱 실패 등 |
| 400 | `INVALID_ID` | ObjectId 형식이 아닌 식별자 |
| 401 | `UNAUTHORIZED` | 미로그인, 만료·위조 토큰, 비활성 계정 |
| 403 | `FORBIDDEN` | 역할·팀 권한 부족 |
| 404 | `NOT_FOUND` | 대상 없음 |
| 409 | `DUPLICATE_KEY` | 이메일·사번·정책 이름·팀 이름 중복 |
| 409 | `ALREADY_BOOTSTRAPPED` | 이미 사용자가 존재 |
| 409 | `POLICY_IN_USE` | 팀 적용 중 또는 근태 기록이 참조하는 정책 삭제 시도 |
| 409 | `SAME_POLICY` | 이미 그 팀에 적용된 정책을 다시 적용 |
| 409 | `TEAM_NOT_ASSIGNED` | 소속 팀이 없는 사용자가 출근 시도 |
| 409 | `TEAM_POLICY_NOT_SET` | 팀에 정책이 없는 상태에서 출근 시도 |
| 409 | `ALREADY_CLOCKED_IN` | 같은 근무일에 두 번 출근 |
| 409 | `NOT_CLOCKED_IN` | 출근 기록 없이 퇴근 |
| 500 | `INTERNAL_ERROR` | 예상하지 못한 오류 (내부 메시지는 노출하지 않음) |

## 4. 근태 판정 규칙

판정 입력은 **근태 기록에 박힌 정책 스냅샷**이다. 정책을 바꿔도 과거 기록의 판정과 표시 기준(`record.policy`)은 변하지 않는다.

### 지각 (출근 시각 기준)

| 정책 | 지각 기준 | `lateMinutes` |
| --- | --- | --- |
| 고정 | `workStartTime + lateGraceMinutes` 초과 | 출근 시각 − `workStartTime` (유예 포함) |
| 유연 | `clockInEndTime` 초과. 코어타임이 있으면 `coreTimeStartTime` 과 비교해 **더 이른 쪽** | 출근 시각 − 그 기준 |
| 비근무일 | 지각 판정 없음 (`isLate: false`) | 0 |

### 실근무시간 · 조기퇴근 (퇴근 시각 기준)

- `workedMinutes` = (퇴근 − 출근) − **겹치는 휴게시간**. 자정을 넘긴 근무도 다음 날 휴게 구간까지 차감한다.
- 고정: `workEndTime` 보다 이르게 퇴근하면 조기퇴근, 부족분이 `earlyLeaveMinutes`.
- 유연: `dailyRequiredMinutes` 미달분과 `coreTimeEndTime` 이탈분 중 **큰 쪽**.
- 비근무일 근무는 기록은 남지만 조기퇴근으로 보지 않는다.

시각 해석은 항상 정책의 `timezone`(기본 `Asia/Seoul`) 기준이다. `workDate` 도 그 시간대의 날짜다.

## 5. 주요 플로우 (curl)

쿠키를 파일에 저장해가며 호출한다.

```bash
BASE=http://localhost:3000/api

# 0) 최초 HR 관리자 (사용자가 0명일 때 한 번만)
curl -s -X POST $BASE/auth/bootstrap -H 'Content-Type: application/json' \
  -d '{"email":"hr@example.com","password":"hrpassword123","name":"HR 관리자"}'

# 1) 로그인 (쿠키 저장)
curl -s -c hr.txt -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"hr@example.com","password":"hrpassword123"}'

# 2) 고정 출퇴근 정책 생성
curl -s -b hr.txt -X POST $BASE/policies -H 'Content-Type: application/json' -d '{
  "name": "표준 9-6",
  "description": "고정 출퇴근",
  "type": "FIXED",
  "workDays": [1,2,3,4,5],
  "timezone": "Asia/Seoul",
  "breakTimes": [{ "startTime": "12:00", "endTime": "13:00" }],
  "fixed": { "workStartTime": "09:00", "workEndTime": "18:00", "lateGraceMinutes": 10 }
}'

# 3) 유연 출퇴근 정책 생성
curl -s -b hr.txt -X POST $BASE/policies -H 'Content-Type: application/json' -d '{
  "name": "유연 근무",
  "type": "FLEXIBLE",
  "breakTimes": [{ "startTime": "12:00", "endTime": "13:00" }],
  "flexible": {
    "clockInStartTime": "07:00",
    "clockInEndTime": "11:00",
    "dailyRequiredMinutes": 480,
    "coreTimeStartTime": "11:00",
    "coreTimeEndTime": "16:00"
  }
}'

# 4) 팀 생성 → 정책 적용
curl -s -b hr.txt -X POST $BASE/teams -H 'Content-Type: application/json' \
  -d '{"name":"개발팀","description":"플랫폼"}'
curl -s -b hr.txt -X PUT $BASE/teams/$TEAM_ID/policy -H 'Content-Type: application/json' \
  -d '{"policyId":"'$FIXED_ID'","reason":"최초 적용"}'

# 5) 직원·팀 관리자 생성, 팀 관리자 권한 부여
curl -s -b hr.txt -X POST $BASE/users -H 'Content-Type: application/json' \
  -d '{"email":"emp@example.com","password":"emppassword123","name":"김직원","role":"EMPLOYEE","teamId":"'$TEAM_ID'","employeeNumber":"E-001"}'
curl -s -b hr.txt -X PATCH $BASE/teams/$TEAM_ID -H 'Content-Type: application/json' \
  -d '{"managerIds":["'$MGR_ID'"]}'

# 6) 직원: 로그인 → 오늘 기준 확인 → 출근 → 퇴근 → 내 기록
curl -s -c emp.txt -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"emp@example.com","password":"emppassword123"}'
curl -s -b emp.txt $BASE/attendance/today
curl -s -b emp.txt -X POST $BASE/attendance/clock-in
curl -s -b emp.txt -X POST $BASE/attendance/clock-out
curl -s -b emp.txt "$BASE/attendance/me?from=2026-09-01&to=2026-09-30"

# 7) 팀 관리자: 팀 근태 / HR: 전사 근태 + 요약
curl -s -b mgr.txt "$BASE/teams/$TEAM_ID/attendance?from=2026-09-01&to=2026-09-30"
curl -s -b hr.txt "$BASE/attendance?from=2026-09-01&to=2026-09-30"
```

### 응답 예시 — `POST /attendance/clock-in`

```jsonc
{
  "success": true,
  "data": {
    "record": {
      "id": "6aba237b43087f15913eedca",
      "userId": "6aba237743087f15913eedc7",
      "teamId": "6aba237543087f15913eedc5",
      "workDate": "2026-09-28",
      "clockInAt": "2026-09-28T08:21:47.123Z",
      "clockOutAt": null,
      "status": "WORKING",
      "workedMinutes": 0,
      "isLate": true,
      "lateMinutes": 501,
      "isEarlyLeave": false,
      "earlyLeaveMinutes": 0,
      "appliedPolicyId": "6aba236f43087f15913eedc1",
      "policy": {
        "type": "FIXED",
        "name": "표준 9-6",
        "timezone": "Asia/Seoul",
        "workDays": [1, 2, 3, 4, 5],
        "breakTimes": [{ "startTime": "12:00", "endTime": "13:00" }],
        "lateAfter": "09:10",
        "fixed": { "workStartTime": "09:00", "workEndTime": "18:00", "lateGraceMinutes": 10 },
        "flexible": null
      }
    }
  }
}
```

### 응답 예시 — `GET /attendance` (HR)

```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...", "workDate": "2026-09-28", "status": "COMPLETED",
        "workedMinutes": 480, "isLate": false, "lateMinutes": 0,
        "policy": { "name": "표준 9-6", "lateAfter": "09:10" },
        "user": { "id": "...", "name": "김직원", "email": "emp@example.com", "employeeNumber": "E-001" }
      }
    ],
    "total": 1, "page": 1, "limit": 20,
    "summary": { "recordCount": 1, "totalWorkedMinutes": 480, "lateCount": 0, "earlyLeaveCount": 0 }
  }
}
```

## 6. 설계 결정

- **정책 스냅샷 임베드** — 출근 시점의 정책을 근태 기록에 값으로 복사한다. 정책 변경은 그 이후 기록에만 적용되고, 과거 기록은 당시 기준으로 남는다.
- **정책 수정 범위 제한** — `PATCH /policies/{id}` 는 이름·설명만 바꾼다. 근무 규칙을 바꾸려면 새 정책을 만들어 팀에 적용해야 하고, 그래야 `TeamPolicyHistory` 에 누가 언제 무엇을 바꿨는지 남는다.
- **삭제 가드 이중화** — 라우트에서 `assertDeletable()` 로 먼저 막고, 스키마의 쿼리 미들웨어가 삭제 경로 자체를 다시 막는다. `_id` 조건 없는 삭제도 거부한다.
- **중복 출근은 DB 가 막는다** — `{userId, workDate}` unique 인덱스가 있어 동시 요청도 한 건만 통과한다.
- **퇴근은 열린 기록을 닫는다** — 근무일을 다시 계산하지 않기 때문에 자정을 넘긴 근무도 같은 기록으로 이어진다.
- **비밀번호·세션은 의존성 없이** — scrypt 해싱과 HS256 서명 모두 Node 내장 `crypto` 로 구현했다. 외부 패키지는 `zod`(검증) 하나만 추가했다.

## 7. 알려진 제약

- 팀 정책 변경은 팀 문서 갱신 후 이력을 기록한다. 둘을 감싸는 트랜잭션이 없어, 이력 기록이 실패하면 정책은 바뀌고 로그만 빠질 수 있다 (Atlas 레플리카셋이라면 트랜잭션으로 묶을 수 있다).
- 공휴일 개념이 없다. 근무일은 정책의 `workDays`(요일)로만 판단한다.
- 휴가·연차, 근태 수정 요청(정정) 플로우는 범위 밖이다.
- 인덱스는 Mongoose `autoIndex` 기본값으로 생성된다. 운영 환경에서는 `autoIndex` 를 끄고 배포 단계에서 `syncIndexes()` 를 실행하는 편이 안전하다.

## 8. 검증 현황

- `pnpm build`, `tsc --noEmit`, `eslint` 통과
- 판정 엔진 단위 테스트 19케이스 통과 (지각 경계, 시간대 변환, 휴게 차감, 야간 근무, 코어타임)
- 실제 MongoDB 대상 E2E 스모크 52케이스 통과 (인증·권한·정책 CRUD·삭제 가드·출퇴근·정책 변경 후 과거 기록 보존)

재현: `pnpm dev` 로 서버를 띄운 뒤 `bash scripts/smoke-api.sh`. **빈 DB** 를 전제로 한다.
