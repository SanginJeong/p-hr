#!/bin/bash
# API 전체 플로우 스모크 테스트.
#
#   pnpm dev                 # 다른 터미널에서 서버를 먼저 띄운다
#   bash scripts/smoke-api.sh
#
# 주의: 실제 DB 에 데이터를 만든다. **빈 DB** 를 전제로 한다
# (최초 HR 관리자 생성과 이름 중복 검사가 들어 있다).
# 전체 API 플로우 스모크 테스트. 성공/실패를 세어 마지막에 요약한다.
API=http://localhost:3000/api
SP="${TMPDIR:-/tmp}/hr-smoke"; mkdir -p "$SP"
BODYF="$SP/body.json"
HR="$SP/jar-hr.txt"; EMP="$SP/jar-emp.txt"; MGR="$SP/jar-mgr.txt"
rm -f "$HR" "$EMP" "$MGR"
pass=0; fail=0

req() {
  local method=$1 path=$2 jar=$3 data=${4:-}
  if [ -n "$data" ]; then
    STATUS=$(curl -s -o "$BODYF" -w '%{http_code}' -X "$method" "$API$path" \
      -H 'Content-Type: application/json' -b "$jar" -c "$jar" -d "$data")
  else
    STATUS=$(curl -s -o "$BODYF" -w '%{http_code}' -X "$method" "$API$path" -b "$jar" -c "$jar")
  fi
  BODY=$(cat "$BODYF")
}

expect() { # label expected_status [jq_filter expected_value]
  local label=$1 want=$2 filter=${3:-} wantval=${4:-}
  local okk=1 detail=""
  [ "$STATUS" = "$want" ] || { okk=0; detail="status=$STATUS want=$want"; }
  if [ -n "$filter" ]; then
    local got; got=$(echo "$BODY" | jq -r "$filter" 2>/dev/null)
    [ "$got" = "$wantval" ] || { okk=0; detail="$detail $filter=$got want=$wantval"; }
  fi
  if [ $okk = 1 ]; then pass=$((pass+1)); echo "PASS | $label"
  else fail=$((fail+1)); echo "FAIL | $label | $detail"; echo "       $(echo "$BODY" | head -c 300)"; fi
}

echo "=== 1. 인증 ==="
req POST /auth/bootstrap "$HR" '{"email":"hr@example.com","password":"hrpassword123","name":"HR 관리자"}'
expect "bootstrap 최초 HR 관리자 생성" 201 '.data.user.role' HR_ADMIN
req POST /auth/bootstrap "$HR" '{"email":"hr2@example.com","password":"hrpassword123","name":"둘째"}'
expect "bootstrap 재실행 거부" 409 '.error.code' ALREADY_BOOTSTRAPPED
req GET /attendance/today "$SP/jar-anon.txt"
expect "미인증 접근 거부" 401 '.error.code' UNAUTHORIZED
req POST /auth/login "$HR" '{"email":"hr@example.com","password":"wrongpassword"}'
expect "잘못된 비밀번호 거부" 401 '.error.code' UNAUTHORIZED
req POST /auth/login "$HR" '{"email":"hr@example.com","password":"hrpassword123"}'
expect "HR 로그인" 200 '.data.user.email' hr@example.com
req GET /auth/me "$HR"
expect "내 정보 조회(팀 없음)" 200 '.data.team' null

echo "=== 2. 정책 ==="
req POST /policies "$HR" '{"name":"표준 9-6","description":"고정 출퇴근","type":"FIXED","breakTimes":[{"startTime":"12:00","endTime":"13:00"}],"fixed":{"workStartTime":"09:00","workEndTime":"18:00","lateGraceMinutes":10}}'
expect "고정 정책 생성" 201 '.data.policy.type' FIXED
FIXED_ID=$(echo "$BODY" | jq -r '.data.policy.id')
req POST /policies "$HR" '{"name":"유연 근무","type":"FLEXIBLE","breakTimes":[{"startTime":"12:00","endTime":"13:00"}],"flexible":{"clockInStartTime":"07:00","clockInEndTime":"11:00","dailyRequiredMinutes":480,"coreTimeStartTime":"11:00","coreTimeEndTime":"16:00"}}'
expect "유연 정책 생성" 201 '.data.policy.flexible.dailyRequiredMinutes' 480
FLEX_ID=$(echo "$BODY" | jq -r '.data.policy.id')
req POST /policies "$HR" '{"name":"잘못된 정책","type":"FIXED","fixed":{"workStartTime":"18:00","workEndTime":"09:00","lateGraceMinutes":0}}'
expect "퇴근<출근 정책 거부" 400 '.error.code' VALIDATION_ERROR
req POST /policies "$HR" '{"name":"유형 불일치","type":"FIXED","flexible":{"clockInStartTime":"07:00","clockInEndTime":"11:00","dailyRequiredMinutes":480}}'
expect "유형에 맞지 않는 설정 거부" 400
req POST /policies "$HR" '{"name":"표준 9-6","type":"FIXED","fixed":{"workStartTime":"09:00","workEndTime":"18:00","lateGraceMinutes":0}}'
expect "중복 이름 거부" 409 '.error.code' DUPLICATE_KEY
req GET /policies "$HR"
expect "정책 목록" 200 '.data.total' 2
req PATCH "/policies/$FIXED_ID" "$HR" '{"description":"설명 수정"}'
expect "정책 설명 수정" 200 '.data.policy.description' "설명 수정"
req DELETE "/policies/$FLEX_ID" "$HR"
expect "미사용 정책 삭제 가능" 200 '.data.deleted' true
req POST /policies "$HR" '{"name":"유연 근무","type":"FLEXIBLE","breakTimes":[{"startTime":"12:00","endTime":"13:00"}],"flexible":{"clockInStartTime":"07:00","clockInEndTime":"11:00","dailyRequiredMinutes":480,"coreTimeStartTime":"11:00","coreTimeEndTime":"16:00"}}'
expect "유연 정책 재생성" 201
FLEX_ID=$(echo "$BODY" | jq -r '.data.policy.id')

echo "=== 3. 팀 · 정책 적용 ==="
req POST /teams "$HR" '{"name":"개발팀","description":"플랫폼"}'
expect "팀 생성" 201 '.data.team.attendancePolicyId' null
TEAM_ID=$(echo "$BODY" | jq -r '.data.team.id')
req GET "/teams/$TEAM_ID/policy" "$HR"
expect "정책 미설정 팀 조회" 200 '.data.policy' null
req PUT "/teams/$TEAM_ID/policy" "$HR" "{\"policyId\":\"$FIXED_ID\",\"reason\":\"최초 적용\"}"
expect "팀에 고정 정책 적용" 200 '.data.criteria.lateAfter' 09:10
req PUT "/teams/$TEAM_ID/policy" "$HR" "{\"policyId\":\"$FIXED_ID\"}"
expect "같은 정책 재적용 거부" 409 '.error.code' SAME_POLICY
req DELETE "/policies/$FIXED_ID" "$HR"
expect "팀 사용 중 정책 삭제 거부" 409 '.error.code' POLICY_IN_USE

echo "=== 4. 구성원 ==="
req POST /users "$HR" "{\"email\":\"emp@example.com\",\"password\":\"emppassword123\",\"name\":\"김직원\",\"role\":\"EMPLOYEE\",\"teamId\":\"$TEAM_ID\",\"employeeNumber\":\"E-001\"}"
expect "직원 생성" 201 '.data.user.role' EMPLOYEE
EMP_ID=$(echo "$BODY" | jq -r '.data.user.id')
req POST /users "$HR" "{\"email\":\"mgr@example.com\",\"password\":\"mgrpassword123\",\"name\":\"박팀장\",\"role\":\"TEAM_MANAGER\",\"teamId\":\"$TEAM_ID\"}"
expect "팀 관리자 생성" 201
MGR_ID=$(echo "$BODY" | jq -r '.data.user.id')
req POST /users "$HR" '{"email":"noteam@example.com","password":"password1234","name":"무소속","role":"EMPLOYEE"}'
expect "팀 없는 직원 생성 거부" 400 '.error.code' VALIDATION_ERROR
req PATCH "/teams/$TEAM_ID" "$HR" "{\"managerIds\":[\"$MGR_ID\"]}"
expect "팀 관리자 지정" 200 '.data.team.managerIds[0]' "$MGR_ID"

echo "=== 5. 직원 근태 ==="
req POST /auth/login "$EMP" '{"email":"emp@example.com","password":"emppassword123"}'
expect "직원 로그인" 200
req GET /auth/me "$EMP"
expect "직원이 본 팀 정책" 200 '.data.policy.name' "표준 9-6"
req GET /attendance/today "$EMP"
expect "출근 전 오늘 조회" 200 '.data.record' null
req POST /policies "$EMP" '{"name":"직원이 만든 정책","type":"FIXED","fixed":{"workStartTime":"09:00","workEndTime":"18:00","lateGraceMinutes":0}}'
expect "직원의 정책 생성 거부" 403 '.error.code' FORBIDDEN
req GET /attendance "$EMP"
expect "직원의 전사 근태 조회 거부" 403 '.error.code' FORBIDDEN
req POST /attendance/clock-out "$EMP"
expect "출근 없이 퇴근 거부" 409 '.error.code' NOT_CLOCKED_IN
req POST /attendance/clock-in "$EMP"
expect "출근 기록" 201 '.data.record.status' WORKING
REC_ID=$(echo "$BODY" | jq -r '.data.record.id')
echo "       (출근 판정: isLate=$(echo "$BODY" | jq -r '.data.record.isLate') 기준=$(echo "$BODY" | jq -r '.data.record.policy.lateAfter'))"
req POST /attendance/clock-in "$EMP"
expect "중복 출근 거부" 409 '.error.code' ALREADY_CLOCKED_IN
req GET /attendance/today "$EMP"
expect "출근 후 오늘 조회" 200 '.data.record.status' WORKING
req POST /attendance/clock-out "$EMP"
expect "퇴근 기록" 200 '.data.record.status' COMPLETED
echo "       (퇴근 판정: worked=$(echo "$BODY" | jq -r '.data.record.workedMinutes')분 조기퇴근=$(echo "$BODY" | jq -r '.data.record.earlyLeaveMinutes')분)"
req GET /attendance/me "$EMP"
expect "내 근태 기록" 200 '.data.total' 1

echo "=== 6. 정책 변경 후 과거 기록 보존 ==="
req PUT "/teams/$TEAM_ID/policy" "$HR" "{\"policyId\":\"$FLEX_ID\",\"reason\":\"유연근무 전환\"}"
expect "팀 정책을 유연으로 변경" 200 '.data.criteria.lateAfter' 11:00
req GET /attendance/me "$EMP"
expect "과거 기록은 당시 기준 유지" 200 '.data.items[0].policy.name' "표준 9-6"
expect "과거 기록의 지각 기준도 당시 값" 200 '.data.items[0].policy.lateAfter' 09:10
req GET /auth/me "$EMP"
expect "직원이 보는 현재 정책은 새 정책" 200 '.data.policy.name' "유연 근무"
req DELETE "/policies/$FIXED_ID" "$HR"
expect "근태 기록이 참조하는 정책 삭제 거부" 409 '.error.code' POLICY_IN_USE
req GET "/teams/$TEAM_ID/policy-history" "$HR"
expect "정책 변경 이력 2건" 200 '.data.total' 2
expect "최신 이력의 변경 전 정책" 200 '.data.items[0].previousPolicyName' "표준 9-6"
expect "최신 이력의 변경 담당자 기록" 200 '.data.items[0].changedBy != null' true

echo "=== 7. 팀 · 전사 조회 권한 ==="
req POST /auth/login "$MGR" '{"email":"mgr@example.com","password":"mgrpassword123"}'
expect "팀 관리자 로그인" 200
req GET "/teams/$TEAM_ID/attendance" "$MGR"
expect "팀 관리자의 팀 근태 조회" 200 '.data.items[0].user.name' "김직원"
req GET /attendance "$MGR"
expect "팀 관리자의 전사 조회 거부" 403 '.error.code' FORBIDDEN
req GET "/teams/$TEAM_ID/attendance" "$EMP"
expect "직원의 팀 근태 조회 거부" 403 '.error.code' FORBIDDEN
req GET /attendance "$HR"
expect "HR 전사 근태 조회" 200 '.data.summary.recordCount' 1
echo "       (요약: worked=$(echo "$BODY" | jq -r '.data.summary.totalWorkedMinutes')분 지각=$(echo "$BODY" | jq -r '.data.summary.lateCount')건)"
req GET "/attendance?from=2020-01-01&to=2020-01-31" "$HR"
expect "기간 필터(과거 구간 0건)" 200 '.data.total' 0
req GET "/attendance?from=2026-12-31&to=2026-01-01" "$HR"
expect "from>to 거부" 400 '.error.code' VALIDATION_ERROR
req POST /auth/logout "$EMP"
expect "로그아웃" 200
req GET /attendance/me "$EMP"
expect "로그아웃 후 접근 거부" 401 '.error.code' UNAUTHORIZED

echo ""
echo "=== $pass passed, $fail failed ==="
echo "IDS teamId=$TEAM_ID empId=$EMP_ID recordId=$REC_ID"
exit $((fail > 0))
