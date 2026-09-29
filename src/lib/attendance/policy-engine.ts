import { timeToMinutes, type PolicySnapshot } from "@/lib/db/models";

/**
 * 근태 판정 엔진. DB·React·fetch 의존성이 없는 순수 모듈이다.
 * 판정 입력은 항상 근태 기록에 박힌 정책 스냅샷이므로, 정책이 나중에 바뀌어도 과거 판정이 흔들리지 않는다.
 */

const MINUTES_PER_DAY = 24 * 60;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  formatterCache.set(timezone, formatter);

  return formatter;
}

export interface LocalTime {
  /** 정책 시간대 기준 "YYYY-MM-DD" */
  date: string;
  /** 정책 시간대 기준 자정부터의 분 */
  minutesOfDay: number;
  /** 0=일 ... 6=토 */
  weekday: number;
}

/** UTC instant 를 정책 시간대의 벽시계 값으로 바꾼다. */
export function toLocalTime(instant: Date, timezone: string): LocalTime {
  const parts = getFormatter(timezone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const date = `${get("year")}-${get("month")}-${get("day")}`;

  return {
    date,
    minutesOfDay: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: weekdayOf(date),
  };
}

/** "YYYY-MM-DD" 의 요일. 시간대에 무관하게 날짜 문자열 자체로 계산한다. */
export function weekdayOf(workDate: string): number {
  return new Date(`${workDate}T00:00:00Z`).getUTCDay();
}

/** 정책 시간대 기준 "오늘". */
export function currentWorkDate(timezone: string, now = new Date()): string {
  return toLocalTime(now, timezone).date;
}

export function isWorkDay(snapshot: PolicySnapshot, workDate: string): boolean {
  return snapshot.workDays.includes(weekdayOf(workDate));
}

/** 분 → "HH:mm". 자정을 넘긴 값은 하루로 감아서 표시한다. */
export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);

  return `${String(hours).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

/**
 * 지각 기준 시각(분).
 * - 고정: 출근 시각 + 지각 유예시간
 * - 유연: 출근 가능 시간 종료. 코어타임이 있으면 더 이른 쪽
 */
export function lateThresholdMinutes(snapshot: PolicySnapshot): number | null {
  if (snapshot.type === "FIXED" && snapshot.fixed) {
    return timeToMinutes(snapshot.fixed.workStartTime) + snapshot.fixed.lateGraceMinutes;
  }

  if (snapshot.type === "FLEXIBLE" && snapshot.flexible) {
    const limits = [timeToMinutes(snapshot.flexible.clockInEndTime)];

    if (snapshot.flexible.coreTimeStartTime) {
      limits.push(timeToMinutes(snapshot.flexible.coreTimeStartTime));
    }

    return Math.min(...limits);
  }

  return null;
}

export interface ClockInEvaluation {
  isLate: boolean;
  /** 기준 시각을 넘긴 분. 고정 정책은 유예시간이 아니라 출근 시각 기준으로 센다. */
  lateMinutes: number;
}

export function evaluateClockIn(snapshot: PolicySnapshot, clockInAt: Date): ClockInEvaluation {
  const local = toLocalTime(clockInAt, snapshot.timezone);

  // 근무일이 아니면 출근 기준이 없다. 휴일 근무는 기록하되 지각으로 보지 않는다.
  if (!isWorkDay(snapshot, local.date)) {
    return { isLate: false, lateMinutes: 0 };
  }

  const threshold = lateThresholdMinutes(snapshot);

  if (threshold === null || local.minutesOfDay <= threshold) {
    return { isLate: false, lateMinutes: 0 };
  }

  const base =
    snapshot.type === "FIXED" && snapshot.fixed
      ? timeToMinutes(snapshot.fixed.workStartTime)
      : threshold;

  return { isLate: true, lateMinutes: local.minutesOfDay - base };
}

/**
 * 출근~퇴근 구간과 겹치는 휴게시간(분).
 * 휴게 구간은 매일 반복되므로, 자정을 넘긴 근무도 다음 날 구간까지 훑는다.
 */
export function overlappingBreakMinutes(
  snapshot: PolicySnapshot,
  startMinutes: number,
  endMinutes: number,
): number {
  let total = 0;

  for (const breakTime of snapshot.breakTimes) {
    const start = timeToMinutes(breakTime.startTime);
    const end = timeToMinutes(breakTime.endTime);

    for (let offset = 0; start + offset < endMinutes; offset += MINUTES_PER_DAY) {
      total += Math.max(
        0,
        Math.min(endMinutes, end + offset) - Math.max(startMinutes, start + offset),
      );
    }
  }

  return total;
}

export interface ClockOutEvaluation {
  /** 휴게시간을 차감한 실근무시간(분) */
  workedMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
}

export function evaluateClockOut(
  snapshot: PolicySnapshot,
  clockInAt: Date,
  clockOutAt: Date,
): ClockOutEvaluation {
  const inLocal = toLocalTime(clockInAt, snapshot.timezone);
  const outLocal = toLocalTime(clockOutAt, snapshot.timezone);

  const spanMinutes = Math.max(
    0,
    Math.floor((clockOutAt.getTime() - clockInAt.getTime()) / 60_000),
  );
  const breakMinutes = overlappingBreakMinutes(
    snapshot,
    inLocal.minutesOfDay,
    inLocal.minutesOfDay + spanMinutes,
  );
  const workedMinutes = Math.max(0, spanMinutes - breakMinutes);

  if (!isWorkDay(snapshot, inLocal.date)) {
    return { workedMinutes, isEarlyLeave: false, earlyLeaveMinutes: 0 };
  }

  // 자정을 넘겨 퇴근했다면 기준 시각보다 이르게 나간 것이 아니다.
  const leftSameDay = outLocal.date === inLocal.date;
  let earlyLeaveMinutes = 0;

  if (snapshot.type === "FIXED" && snapshot.fixed) {
    const workEnd = timeToMinutes(snapshot.fixed.workEndTime);

    if (leftSameDay && outLocal.minutesOfDay < workEnd) {
      earlyLeaveMinutes = workEnd - outLocal.minutesOfDay;
    }
  } else if (snapshot.type === "FLEXIBLE" && snapshot.flexible) {
    // 소정 근무시간 미달과 코어타임 이탈 중 더 큰 쪽을 조기퇴근으로 본다.
    const shortfall = Math.max(0, snapshot.flexible.dailyRequiredMinutes - workedMinutes);
    const coreTimeEnd = snapshot.flexible.coreTimeEndTime
      ? timeToMinutes(snapshot.flexible.coreTimeEndTime)
      : null;
    const coreShortfall =
      coreTimeEnd !== null && leftSameDay && outLocal.minutesOfDay < coreTimeEnd
        ? coreTimeEnd - outLocal.minutesOfDay
        : 0;

    earlyLeaveMinutes = Math.max(shortfall, coreShortfall);
  }

  return { workedMinutes, isEarlyLeave: earlyLeaveMinutes > 0, earlyLeaveMinutes };
}

export interface PolicyCriteria {
  type: PolicySnapshot["type"];
  name: string;
  timezone: string;
  workDays: number[];
  breakTimes: PolicySnapshot["breakTimes"];
  /** 이 시각을 넘겨 출근하면 지각 */
  lateAfter: string | null;
  fixed: PolicySnapshot["fixed"];
  flexible: PolicySnapshot["flexible"];
}

/** 직원·관리자 화면에 그대로 내려줄 "오늘의 기준". */
export function describeCriteria(snapshot: PolicySnapshot): PolicyCriteria {
  const threshold = lateThresholdMinutes(snapshot);

  return {
    type: snapshot.type,
    name: snapshot.name,
    timezone: snapshot.timezone,
    workDays: snapshot.workDays,
    breakTimes: snapshot.breakTimes,
    lateAfter: threshold === null ? null : minutesToTime(threshold),
    fixed: snapshot.fixed ?? null,
    flexible: snapshot.flexible ?? null,
  };
}
