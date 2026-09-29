import {
  ATTENDANCE_STATUSES,
  DEFAULT_TIMEZONE,
  POLICY_TYPES,
  USER_ROLES,
} from "@/lib/db/models/constants";

/**
 * OpenAPI 3.1 문서. 실제 라우트와 같은 열거형 상수를 참조해 스펙이 코드와 어긋나지 않게 한다.
 * GET /api/openapi 로 서빙되고, /api-docs 의 Swagger UI 가 이 문서를 읽는다.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** 성공 응답은 항상 { success: true, data } 로 감싼다. */
const success = (data: object) => ({
  type: "object",
  required: ["success", "data"],
  properties: { success: { type: "boolean", const: true }, data },
});

const json = (description: string, schema: object) => ({
  description,
  content: { "application/json": { schema } },
});

const errorResponse = (description: string) => json(description, ref("ApiError"));

const paginated = (itemSchema: object, extra: Record<string, object> = {}) =>
  success({
    type: "object",
    required: ["items", "total", "page", "limit"],
    properties: {
      items: { type: "array", items: itemSchema },
      total: { type: "integer", description: "필터 전체 건수" },
      page: { type: "integer" },
      limit: { type: "integer" },
      ...extra,
    },
  });

const timeString = {
  type: "string",
  pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
  examples: ["09:00"],
  description: "HH:mm",
};

const nullableTime = { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" };

const paginationParams = [
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "1부터 시작",
  },
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
];

const dateRangeParams = [
  {
    name: "from",
    in: "query",
    schema: { type: "string", format: "date" },
    description: "근무일 시작 (YYYY-MM-DD, 포함)",
  },
  {
    name: "to",
    in: "query",
    schema: { type: "string", format: "date" },
    description: "근무일 종료 (YYYY-MM-DD, 포함)",
  },
];

const objectIdParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
});

const commonErrors = {
  "400": errorResponse("검증 실패 (VALIDATION_ERROR, BAD_REQUEST, INVALID_ID)"),
  "401": errorResponse("미인증 (UNAUTHORIZED)"),
  "403": errorResponse("권한 없음 (FORBIDDEN)"),
};

const baseDocument = {
  openapi: "3.1.0",
  info: {
    title: "HR Platform 근태 API",
    version: "1.0.0",
    description: [
      "근태 정책·팀·근태 기록을 다루는 REST API.",
      "",
      "**응답 형식** — 성공은 `{ success: true, data }`, 실패는 `{ success: false, error: { code, message, details? } }`.",
      "",
      "**인증** — `POST /api/auth/login` 이 httpOnly 쿠키 `hr_session`(HS256 JWT, 7일)을 내려준다. 이후 요청은 쿠키로 인증된다.",
      "",
      "**권한** — `HR_ADMIN` 은 전체, 팀 관리자는 `Team.managerIds` 에 등록된 팀만, 직원은 본인 기록만 볼 수 있다.",
      "",
      "**정책 스냅샷** — 근태 기록은 생성 시점의 정책을 값으로 복사해 보관한다. 정책을 바꿔도 과거 기록의 판정 기준(`record.policy`)은 변하지 않는다.",
    ].join("\n"),
  },
  servers: [{ url: "/api", description: "같은 오리진" }],
  tags: [
    { name: "auth", description: "인증" },
    { name: "users", description: "구성원 (HR 관리자)" },
    { name: "policies", description: "근태 정책 (HR 관리자)" },
    { name: "teams", description: "팀 · 정책 적용" },
    { name: "attendance", description: "근태 기록" },
    { name: "system", description: "상태 확인" },
  ],
  security: [{ cookieAuth: [] }],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "hr_session" },
    },
    schemas: {
      ApiError: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", const: false },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                description: "기계가 분기하는 코드",
                examples: ["VALIDATION_ERROR", "POLICY_IN_USE", "ALREADY_CLOCKED_IN"],
              },
              message: { type: "string", description: "사용자에게 보여줄 한국어 메시지" },
              details: { description: "검증 실패 시 필드별 사유" },
            },
          },
        },
      },
      BreakTime: {
        type: "object",
        required: ["startTime", "endTime"],
        properties: { startTime: timeString, endTime: timeString },
        description: "휴게 구간. 실근무시간에서 차감된다.",
      },
      FixedConfig: {
        type: "object",
        required: ["workStartTime", "workEndTime", "lateGraceMinutes"],
        properties: {
          workStartTime: timeString,
          workEndTime: timeString,
          lateGraceMinutes: {
            type: "integer",
            minimum: 0,
            maximum: 1440,
            default: 0,
            description: "출근 시각 + 이 시간까지는 지각이 아니다.",
          },
        },
      },
      FlexibleConfig: {
        type: "object",
        required: ["clockInStartTime", "clockInEndTime", "dailyRequiredMinutes"],
        properties: {
          clockInStartTime: timeString,
          clockInEndTime: timeString,
          dailyRequiredMinutes: { type: "integer", minimum: 1, maximum: 1440 },
          coreTimeStartTime: nullableTime,
          coreTimeEndTime: nullableTime,
        },
        description: "코어타임은 시작·종료를 함께 설정해야 한다.",
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          role: { type: "string", enum: [...USER_ROLES] },
          teamId: { type: ["string", "null"] },
          employeeNumber: { type: ["string", "null"] },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Team: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          managerIds: {
            type: "array",
            items: { type: "string" },
            description: "이 팀의 근태를 조회할 수 있는 사용자",
          },
          attendancePolicyId: { type: ["string", "null"], description: "팀당 하나" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Policy: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          type: { type: "string", enum: [...POLICY_TYPES] },
          workDays: {
            type: "array",
            items: { type: "integer", minimum: 0, maximum: 6 },
            description: "0=일 ... 6=토",
          },
          timezone: { type: "string", default: DEFAULT_TIMEZONE },
          breakTimes: { type: "array", items: ref("BreakTime") },
          fixed: { oneOf: [ref("FixedConfig"), { type: "null" }] },
          flexible: { oneOf: [ref("FlexibleConfig"), { type: "null" }] },
          createdBy: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PolicyCriteria: {
        type: "object",
        description: "판정 기준 요약. 근태 기록에서는 그 기록이 판정된 당시 기준이다.",
        properties: {
          type: { type: "string", enum: [...POLICY_TYPES] },
          name: { type: "string" },
          timezone: { type: "string" },
          workDays: { type: "array", items: { type: "integer" } },
          breakTimes: { type: "array", items: ref("BreakTime") },
          lateAfter: {
            type: ["string", "null"],
            description: "이 시각을 넘겨 출근하면 지각",
            examples: ["09:10"],
          },
          fixed: { oneOf: [ref("FixedConfig"), { type: "null" }] },
          flexible: { oneOf: [ref("FlexibleConfig"), { type: "null" }] },
        },
      },
      AttendanceRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          teamId: { type: "string" },
          workDate: {
            type: "string",
            format: "date",
            description: "정책 시간대 기준 근무일",
          },
          clockInAt: { type: ["string", "null"], format: "date-time" },
          clockOutAt: { type: ["string", "null"], format: "date-time" },
          status: { type: "string", enum: [...ATTENDANCE_STATUSES] },
          workedMinutes: { type: "integer", description: "휴게시간 차감 후 실근무시간(분)" },
          isLate: { type: "boolean" },
          lateMinutes: { type: "integer" },
          isEarlyLeave: { type: "boolean" },
          earlyLeaveMinutes: { type: "integer" },
          appliedPolicyId: { type: "string" },
          policy: ref("PolicyCriteria"),
        },
      },
      AttendanceRecordWithUser: {
        allOf: [
          ref("AttendanceRecord"),
          {
            type: "object",
            properties: {
              user: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      email: { type: "string" },
                      employeeNumber: { type: ["string", "null"] },
                    },
                  },
                  { type: "null" },
                ],
              },
            },
          },
        ],
      },
      AttendanceSummary: {
        type: "object",
        description: "현재 페이지가 아니라 필터 전체에 대한 합계",
        properties: {
          recordCount: { type: "integer" },
          totalWorkedMinutes: { type: "integer" },
          lateCount: { type: "integer" },
          earlyLeaveCount: { type: "integer" },
        },
      },
      PolicyHistory: {
        type: "object",
        properties: {
          id: { type: "string" },
          teamId: { type: "string" },
          previousPolicyId: { type: ["string", "null"] },
          previousPolicyName: { type: ["string", "null"] },
          newPolicyId: { type: "string" },
          newPolicyName: { type: "string" },
          changedBy: { type: "string", description: "변경 담당자" },
          changedAt: { type: "string", format: "date-time" },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["system"],
        summary: "MongoDB 연결 확인",
        security: [],
        responses: {
          "200": json("연결 성공", {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              database: { type: "string" },
              readyState: { type: "integer" },
            },
          }),
          "500": errorResponse("연결 실패"),
        },
      },
    },
    "/auth/bootstrap": {
      post: {
        tags: ["auth"],
        summary: "최초 HR 관리자 생성",
        description: "사용자가 한 명도 없을 때만 동작한다. 이후에는 항상 409.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", maxLength: 50 },
                },
              },
            },
          },
        },
        responses: {
          "201": json("생성됨", success({ type: "object", properties: { user: ref("User") } })),
          "400": errorResponse("검증 실패"),
          "409": errorResponse("이미 사용자가 있음 (ALREADY_BOOTSTRAPPED)"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["auth"],
        summary: "로그인",
        description: "성공 시 httpOnly 쿠키 `hr_session` 을 내려준다.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("로그인 성공", success({ type: "object", properties: { user: ref("User") } })),
          "400": errorResponse("검증 실패"),
          "401": errorResponse("이메일·비밀번호 불일치 또는 비활성 계정"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["auth"],
        summary: "로그아웃",
        description: "세션 쿠키를 만료시킨다. 로그인 여부와 무관하게 200.",
        security: [],
        responses: {
          "200": json(
            "로그아웃",
            success({ type: "object", properties: { loggedOut: { type: "boolean" } } }),
          ),
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["auth"],
        summary: "내 정보 + 소속 팀 + 팀 정책 기준",
        description: "소속 팀이나 정책이 없으면 해당 항목은 null 이다(에러가 아니다).",
        responses: {
          "200": json(
            "조회 성공",
            success({
              type: "object",
              properties: {
                user: ref("User"),
                team: { oneOf: [ref("Team"), { type: "null" }] },
                policy: { oneOf: [ref("PolicyCriteria"), { type: "null" }] },
              },
            }),
          ),
          "401": errorResponse("미인증"),
        },
      },
    },
    "/users": {
      get: {
        tags: ["users"],
        summary: "구성원 목록 (HR 관리자)",
        parameters: [
          ...paginationParams,
          { name: "teamId", in: "query", schema: { type: "string" } },
          { name: "role", in: "query", schema: { type: "string", enum: [...USER_ROLES] } },
          { name: "isActive", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        ],
        responses: { "200": json("목록", paginated(ref("User"))), ...commonErrors },
      },
      post: {
        tags: ["users"],
        summary: "구성원 생성 (HR 관리자)",
        description: "비밀번호는 scrypt 해시로만 저장된다. HR 관리자 외에는 teamId 가 필수다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", maxLength: 50 },
                  role: { type: "string", enum: [...USER_ROLES], default: "EMPLOYEE" },
                  teamId: { type: ["string", "null"] },
                  employeeNumber: { type: ["string", "null"], maxLength: 30 },
                },
              },
            },
          },
        },
        responses: {
          "201": json("생성됨", success({ type: "object", properties: { user: ref("User") } })),
          ...commonErrors,
          "409": errorResponse("이메일·사번 중복 (DUPLICATE_KEY)"),
        },
      },
    },
    "/users/{userId}": {
      get: {
        tags: ["users"],
        summary: "구성원 상세 (HR 관리자)",
        parameters: [objectIdParam("userId")],
        responses: {
          "200": json("조회", success({ type: "object", properties: { user: ref("User") } })),
          ...commonErrors,
          "404": errorResponse("없음"),
        },
      },
      patch: {
        tags: ["users"],
        summary: "구성원 수정 (HR 관리자)",
        description: "팀 이동·역할 변경·퇴사 처리(isActive=false)·비밀번호 재설정.",
        parameters: [objectIdParam("userId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  name: { type: "string", maxLength: 50 },
                  role: { type: "string", enum: [...USER_ROLES] },
                  teamId: { type: ["string", "null"] },
                  employeeNumber: { type: ["string", "null"] },
                  isActive: { type: "boolean" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": json("수정됨", success({ type: "object", properties: { user: ref("User") } })),
          ...commonErrors,
          "404": errorResponse("없음"),
        },
      },
    },
    "/policies": {
      get: {
        tags: ["policies"],
        summary: "근태 정책 목록 (HR 관리자)",
        parameters: [
          ...paginationParams,
          { name: "type", in: "query", schema: { type: "string", enum: [...POLICY_TYPES] } },
        ],
        responses: { "200": json("목록", paginated(ref("Policy"))), ...commonErrors },
      },
      post: {
        tags: ["policies"],
        summary: "근태 정책 생성 (HR 관리자)",
        description:
          "type=FIXED 면 fixed, FLEXIBLE 이면 flexible 이 필수다. 반대쪽 설정을 함께 보내면 400.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    title: "고정 출퇴근",
                    type: "object",
                    required: ["name", "type", "fixed"],
                    properties: {
                      name: { type: "string", maxLength: 100 },
                      description: { type: "string", maxLength: 500 },
                      type: { const: "FIXED" },
                      workDays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
                      timezone: { type: "string", default: DEFAULT_TIMEZONE },
                      breakTimes: { type: "array", items: ref("BreakTime") },
                      fixed: ref("FixedConfig"),
                    },
                  },
                  {
                    title: "유연 출퇴근",
                    type: "object",
                    required: ["name", "type", "flexible"],
                    properties: {
                      name: { type: "string", maxLength: 100 },
                      description: { type: "string", maxLength: 500 },
                      type: { const: "FLEXIBLE" },
                      workDays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
                      timezone: { type: "string", default: DEFAULT_TIMEZONE },
                      breakTimes: { type: "array", items: ref("BreakTime") },
                      flexible: ref("FlexibleConfig"),
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          "201": json("생성됨", success({ type: "object", properties: { policy: ref("Policy") } })),
          ...commonErrors,
          "409": errorResponse("이름 중복 (DUPLICATE_KEY)"),
        },
      },
    },
    "/policies/{policyId}": {
      get: {
        tags: ["policies"],
        summary: "정책 상세 (HR 관리자)",
        parameters: [objectIdParam("policyId")],
        responses: {
          "200": json("조회", success({ type: "object", properties: { policy: ref("Policy") } })),
          ...commonErrors,
          "404": errorResponse("없음"),
        },
      },
      patch: {
        tags: ["policies"],
        summary: "정책 이름·설명 수정 (HR 관리자)",
        description:
          "근무 규칙은 수정할 수 없다. 규칙을 바꾸려면 새 정책을 만들어 팀에 적용한다(변경 이력이 남는다).",
        parameters: [objectIdParam("policyId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  name: { type: "string", maxLength: 100 },
                  description: { type: ["string", "null"], maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "200": json("수정됨", success({ type: "object", properties: { policy: ref("Policy") } })),
          ...commonErrors,
          "404": errorResponse("없음"),
        },
      },
      delete: {
        tags: ["policies"],
        summary: "정책 삭제 (HR 관리자)",
        description: "팀에 적용 중이거나 근태 기록이 참조하는 정책은 삭제할 수 없다.",
        parameters: [objectIdParam("policyId")],
        responses: {
          "200": json(
            "삭제됨",
            success({
              type: "object",
              properties: { deleted: { type: "boolean" }, id: { type: "string" } },
            }),
          ),
          ...commonErrors,
          "404": errorResponse("없음"),
          "409": errorResponse("사용 중 (POLICY_IN_USE)"),
        },
      },
    },
    "/teams": {
      get: {
        tags: ["teams"],
        summary: "팀 목록 (HR 관리자)",
        parameters: paginationParams,
        responses: { "200": json("목록", paginated(ref("Team"))), ...commonErrors },
      },
      post: {
        tags: ["teams"],
        summary: "팀 생성 (HR 관리자)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", maxLength: 100 },
                  description: { type: "string", maxLength: 500 },
                  managerIds: { type: "array", items: { type: "string" } },
                  attendancePolicyId: { type: ["string", "null"] },
                },
              },
            },
          },
        },
        responses: {
          "201": json("생성됨", success({ type: "object", properties: { team: ref("Team") } })),
          ...commonErrors,
          "409": errorResponse("팀 이름 중복 (DUPLICATE_KEY)"),
        },
      },
    },
    "/teams/{teamId}": {
      get: {
        tags: ["teams"],
        summary: "팀 상세",
        description: "HR 관리자, 해당 팀 관리자, 소속 팀원이 조회할 수 있다.",
        parameters: [objectIdParam("teamId")],
        responses: {
          "200": json("조회", success({ type: "object", properties: { team: ref("Team") } })),
          ...commonErrors,
          "404": errorResponse("없음"),
        },
      },
      patch: {
        tags: ["teams"],
        summary: "팀 정보 수정 (HR 관리자)",
        description: "정책 변경은 PUT /teams/{teamId}/policy 를 쓴다.",
        parameters: [objectIdParam("teamId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  name: { type: "string", maxLength: 100 },
                  description: { type: ["string", "null"] },
                  managerIds: { type: "array", items: { type: "string" } },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("수정됨", success({ type: "object", properties: { team: ref("Team") } })),
          ...commonErrors,
          "404": errorResponse("없음"),
        },
      },
    },
    "/teams/{teamId}/policy": {
      get: {
        tags: ["teams"],
        summary: "팀에 적용된 현재 정책",
        description: "HR 관리자, 해당 팀 관리자, 소속 팀원. 미설정이면 policy 가 null 이다.",
        parameters: [objectIdParam("teamId")],
        responses: {
          "200": json(
            "조회",
            success({
              type: "object",
              properties: {
                teamId: { type: "string" },
                policy: { oneOf: [ref("Policy"), { type: "null" }] },
                criteria: { oneOf: [ref("PolicyCriteria"), { type: "null" }] },
              },
            }),
          ),
          ...commonErrors,
          "404": errorResponse("팀 없음"),
        },
      },
      put: {
        tags: ["teams"],
        summary: "팀 정책 적용·변경 (HR 관리자)",
        description:
          "변경 즉시 이후 생성되는 근태 기록에 적용된다. 이미 생성된 기록은 자기 스냅샷을 유지한다. 변경 이력이 함께 기록된다.",
        parameters: [objectIdParam("teamId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["policyId"],
                properties: {
                  policyId: { type: "string" },
                  reason: { type: "string", maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "200": json(
            "적용됨",
            success({
              type: "object",
              properties: {
                team: ref("Team"),
                policy: ref("Policy"),
                criteria: ref("PolicyCriteria"),
                history: ref("PolicyHistory"),
              },
            }),
          ),
          ...commonErrors,
          "404": errorResponse("팀 또는 정책 없음"),
          "409": errorResponse("이미 적용된 정책 (SAME_POLICY)"),
        },
      },
    },
    "/teams/{teamId}/policy-history": {
      get: {
        tags: ["teams"],
        summary: "정책 변경 이력 (HR 관리자, 해당 팀 관리자)",
        description: "최신 변경이 먼저 온다. 변경 담당자와 변경 시각이 포함된다.",
        parameters: [objectIdParam("teamId"), ...paginationParams],
        responses: {
          "200": json("목록", paginated(ref("PolicyHistory"))),
          ...commonErrors,
          "404": errorResponse("팀 없음"),
        },
      },
    },
    "/teams/{teamId}/attendance": {
      get: {
        tags: ["attendance"],
        summary: "팀원 근태 기록 (HR 관리자, 해당 팀 관리자)",
        parameters: [
          objectIdParam("teamId"),
          ...paginationParams,
          ...dateRangeParams,
          { name: "userId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": json(
            "목록",
            paginated(ref("AttendanceRecordWithUser"), { summary: ref("AttendanceSummary") }),
          ),
          ...commonErrors,
          "404": errorResponse("팀 없음"),
        },
      },
    },
    "/attendance/today": {
      get: {
        tags: ["attendance"],
        summary: "오늘의 내 근태 + 적용 기준",
        description:
          "소속 팀이나 정책이 없어도 200. openRecord 는 아직 퇴근하지 않은 기록(자정을 넘긴 근무라면 어제 날짜일 수 있다).",
        responses: {
          "200": json(
            "조회",
            success({
              type: "object",
              properties: {
                workDate: { type: "string", format: "date" },
                timezone: { type: "string" },
                isWorkDay: { type: ["boolean", "null"] },
                teamId: { type: ["string", "null"] },
                policy: { oneOf: [ref("PolicyCriteria"), { type: "null" }] },
                record: { oneOf: [ref("AttendanceRecord"), { type: "null" }] },
                openRecord: { oneOf: [ref("AttendanceRecord"), { type: "null" }] },
              },
            }),
          ),
          "401": errorResponse("미인증"),
        },
      },
    },
    "/attendance/clock-in": {
      post: {
        tags: ["attendance"],
        summary: "출근 기록",
        description: "팀 정책을 스냅샷으로 박고 그 기준으로 지각을 판정한다. 같은 근무일 두 번째 요청은 409.",
        responses: {
          "201": json(
            "기록됨",
            success({ type: "object", properties: { record: ref("AttendanceRecord") } }),
          ),
          "401": errorResponse("미인증"),
          "404": errorResponse("팀 없음"),
          "409": errorResponse(
            "중복 출근 (ALREADY_CLOCKED_IN) · 팀 미배정 (TEAM_NOT_ASSIGNED) · 정책 미설정 (TEAM_POLICY_NOT_SET)",
          ),
        },
      },
    },
    "/attendance/clock-out": {
      post: {
        tags: ["attendance"],
        summary: "퇴근 기록",
        description: "열려 있는 가장 최근 기록을 닫는다. 실근무시간은 기록의 스냅샷 기준으로 계산된다.",
        responses: {
          "200": json(
            "기록됨",
            success({ type: "object", properties: { record: ref("AttendanceRecord") } }),
          ),
          "401": errorResponse("미인증"),
          "409": errorResponse("출근 기록 없음 (NOT_CLOCKED_IN)"),
        },
      },
    },
    "/attendance/me": {
      get: {
        tags: ["attendance"],
        summary: "내 일별 근태 기록",
        description: "본인 기록만 반환한다. userId 를 넣어 다른 사람을 조회할 수 없다.",
        parameters: [...paginationParams, ...dateRangeParams],
        responses: {
          "200": json(
            "목록",
            paginated(ref("AttendanceRecordWithUser"), { summary: ref("AttendanceSummary") }),
          ),
          "400": errorResponse("from > to"),
          "401": errorResponse("미인증"),
        },
      },
    },
    "/attendance": {
      get: {
        tags: ["attendance"],
        summary: "전체 팀 근태 기록 (HR 관리자)",
        description: "summary 로 필터 전체의 실근무시간 합계·지각 건수를 함께 준다.",
        parameters: [
          ...paginationParams,
          ...dateRangeParams,
          { name: "teamId", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": json(
            "목록",
            paginated(ref("AttendanceRecordWithUser"), { summary: ref("AttendanceSummary") }),
          ),
          ...commonErrors,
        },
      },
    },
  },
} as const;

/**
 * 클라이언트 코드 생성기가 쓰기 좋은 이름.
 * 경로에서 자동 생성하면 `get_teams__teamId__attendance` 같은 이름이 나오므로 직접 붙인다.
 */
const OPERATION_IDS: Record<string, string> = {
  "get /health": "checkHealth",
  "post /auth/bootstrap": "bootstrapFirstAdmin",
  "post /auth/login": "login",
  "post /auth/logout": "logout",
  "get /auth/me": "getMyProfile",
  "get /users": "listUsers",
  "post /users": "createUser",
  "get /users/{userId}": "getUser",
  "patch /users/{userId}": "updateUser",
  "get /policies": "listPolicies",
  "post /policies": "createPolicy",
  "get /policies/{policyId}": "getPolicy",
  "patch /policies/{policyId}": "updatePolicy",
  "delete /policies/{policyId}": "deletePolicy",
  "get /teams": "listTeams",
  "post /teams": "createTeam",
  "get /teams/{teamId}": "getTeam",
  "patch /teams/{teamId}": "updateTeam",
  "get /teams/{teamId}/policy": "getTeamPolicy",
  "put /teams/{teamId}/policy": "applyTeamPolicy",
  "get /teams/{teamId}/policy-history": "listTeamPolicyHistory",
  "get /teams/{teamId}/attendance": "listTeamAttendance",
  "get /attendance/today": "getTodayAttendance",
  "post /attendance/clock-in": "clockIn",
  "post /attendance/clock-out": "clockOut",
  "get /attendance/me": "listMyAttendance",
  "get /attendance": "listAllAttendance",
};

/** operationId 가 빠진 오퍼레이션이 있으면 즉시 실패시킨다(문서와 라우트가 어긋나는 것을 조기에 잡는다). */
function withOperationIds(document: typeof baseDocument) {
  const cloned = structuredClone(document) as unknown as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };

  for (const [path, operations] of Object.entries(cloned.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const operationId = OPERATION_IDS[`${method} ${path}`];

      if (!operationId) {
        throw new Error(`operationId 가 정의되지 않았습니다: ${method.toUpperCase()} ${path}`);
      }

      operation.operationId = operationId;
    }
  }

  return cloned as unknown as typeof baseDocument;
}

export const openApiDocument = withOperationIds(baseDocument);
