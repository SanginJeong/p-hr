import type { Types } from "mongoose";

import { conflict, notFound } from "@/lib/api/errors";
import {
  AttendancePolicy,
  AttendanceRecord,
  Team,
  type IAttendancePolicy,
  type IAttendanceRecord,
  type PolicySnapshot,
} from "@/lib/db/models";
import type { CurrentUser } from "@/lib/auth/guard";
import { currentWorkDate, evaluateClockIn, evaluateClockOut } from "./policy-engine";

/**
 * 정책 문서에서 근태 기록에 박을 스냅샷을 만든다. 참조가 아니라 값 복사다.
 * 필드를 하나씩 옮긴다 — 스프레드(`{ ...policy.fixed }`)는 Mongoose 서브도큐먼트의
 * 내부 프로퍼티만 복사하고 실제 값은 빠뜨린다(타입만 보면 드러나지 않는다).
 */
export function toSnapshot(policy: IAttendancePolicy): PolicySnapshot {
  return {
    name: policy.name,
    type: policy.type,
    workDays: [...policy.workDays],
    timezone: policy.timezone,
    breakTimes: policy.breakTimes.map((breakTime) => ({
      startTime: breakTime.startTime,
      endTime: breakTime.endTime,
    })),
    fixed: policy.fixed
      ? {
          workStartTime: policy.fixed.workStartTime,
          workEndTime: policy.fixed.workEndTime,
          lateGraceMinutes: policy.fixed.lateGraceMinutes,
        }
      : null,
    flexible: policy.flexible
      ? {
          clockInStartTime: policy.flexible.clockInStartTime,
          clockInEndTime: policy.flexible.clockInEndTime,
          dailyRequiredMinutes: policy.flexible.dailyRequiredMinutes,
          coreTimeStartTime: policy.flexible.coreTimeStartTime ?? null,
          coreTimeEndTime: policy.flexible.coreTimeEndTime ?? null,
        }
      : null,
  };
}

/** 팀에 적용된 현재 정책. 팀이 없거나 정책이 미설정이면 각각 다른 코드로 거부한다. */
export async function resolveTeamPolicy(teamId: string | Types.ObjectId) {
  const team = await Team.findById(teamId);

  if (!team) {
    throw notFound("팀을 찾을 수 없습니다.");
  }

  if (!team.attendancePolicyId) {
    throw conflict("TEAM_POLICY_NOT_SET", "팀에 적용된 근태 정책이 없습니다.");
  }

  const policy = await AttendancePolicy.findById(team.attendancePolicyId);

  if (!policy) {
    throw conflict("TEAM_POLICY_NOT_SET", "팀에 적용된 근태 정책을 찾을 수 없습니다.");
  }

  return { team, policy };
}

function requireTeam(user: CurrentUser): string {
  if (!user.teamId) {
    throw conflict("TEAM_NOT_ASSIGNED", "소속 팀이 없어 근태를 기록할 수 없습니다.");
  }

  return user.teamId;
}

/** 출근 기록. 같은 근무일에 두 번 누르면 409. */
export async function clockIn(user: CurrentUser): Promise<IAttendanceRecord> {
  const { team, policy } = await resolveTeamPolicy(requireTeam(user));
  const snapshot = toSnapshot(policy);
  const now = new Date();
  const workDate = currentWorkDate(snapshot.timezone, now);

  const existing = await AttendanceRecord.findOne({ userId: user.id, workDate });

  if (existing) {
    throw conflict("ALREADY_CLOCKED_IN", "이미 오늘 출근을 기록했습니다.");
  }

  const evaluation = evaluateClockIn(snapshot, now);

  try {
    return await AttendanceRecord.create({
      userId: user.id,
      teamId: team._id,
      workDate,
      clockInAt: now,
      status: "WORKING",
      isLate: evaluation.isLate,
      lateMinutes: evaluation.lateMinutes,
      appliedPolicyId: policy._id,
      policySnapshot: snapshot,
    });
  } catch (error) {
    // unique 인덱스가 동시 요청을 막았을 때도 같은 응답을 준다.
    if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
      throw conflict("ALREADY_CLOCKED_IN", "이미 오늘 출근을 기록했습니다.");
    }

    throw error;
  }
}

/**
 * 퇴근 기록. 열려 있는(퇴근 미기록) 가장 최근 기록을 닫는다.
 * 근무일을 다시 계산하지 않으므로 자정을 넘긴 근무도 같은 기록으로 이어진다.
 */
export async function clockOut(user: CurrentUser): Promise<IAttendanceRecord> {
  const record = await AttendanceRecord.findOne({
    userId: user.id,
    clockInAt: { $ne: null },
    clockOutAt: null,
  }).sort({ workDate: -1 });

  if (!record) {
    throw conflict("NOT_CLOCKED_IN", "출근 기록이 없어 퇴근을 기록할 수 없습니다.");
  }

  const now = new Date();
  const evaluation = evaluateClockOut(record.policySnapshot, record.clockInAt!, now);

  record.clockOutAt = now;
  record.status = "COMPLETED";
  record.workedMinutes = evaluation.workedMinutes;
  record.isEarlyLeave = evaluation.isEarlyLeave;
  record.earlyLeaveMinutes = evaluation.earlyLeaveMinutes;

  await record.save();

  return record;
}
