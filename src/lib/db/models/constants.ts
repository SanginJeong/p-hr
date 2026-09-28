/** 도메인 전역에서 공유하는 열거형과 검증 규칙. */

/** 사용자 역할. HR 관리자 > 팀 관리자 > 직원 순으로 권한이 넓다. */
export const USER_ROLES = ["HR_ADMIN", "TEAM_MANAGER", "EMPLOYEE"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** 근태 정책 유형. */
export const POLICY_TYPES = ["FIXED", "FLEXIBLE"] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

/**
 * 근태 기록의 진행 상태.
 * 지각·조기퇴근은 이 상태와 직교하므로 별도 필드(isLate, isEarlyLeave)로 둔다.
 */
export const ATTENDANCE_STATUSES = ["WORKING", "COMPLETED", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** "HH:mm" (00:00 ~ 23:59) */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "YYYY-MM-DD" */
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const DEFAULT_TIMEZONE = "Asia/Seoul";

/** 0=일요일 ... 6=토요일. 기본값은 월~금. */
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

/** "HH:mm" → 자정 기준 분. 시각 비교·검증에 사용한다. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
