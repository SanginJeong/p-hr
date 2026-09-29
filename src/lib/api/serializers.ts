import type {
  IAttendancePolicy,
  IAttendanceRecord,
  ITeam,
  ITeamPolicyHistory,
  IUser,
} from "@/lib/db/models";
import { describeCriteria } from "@/lib/attendance/policy-engine";

/** API 응답은 항상 문자열 id 로 내려간다. ObjectId 를 그대로 노출하지 않는다. */
const id = (value: { toString(): string } | null | undefined) =>
  value ? value.toString() : null;

export function serializeUser(user: IUser) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    teamId: id(user.teamId),
    employeeNumber: user.employeeNumber ?? null,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export function serializePolicy(policy: IAttendancePolicy) {
  return {
    id: policy._id.toString(),
    name: policy.name,
    description: policy.description ?? null,
    type: policy.type,
    workDays: policy.workDays,
    timezone: policy.timezone,
    breakTimes: policy.breakTimes,
    fixed: policy.fixed ?? null,
    flexible: policy.flexible ?? null,
    createdBy: id(policy.createdBy),
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

export function serializeTeam(team: ITeam) {
  return {
    id: team._id.toString(),
    name: team.name,
    description: team.description ?? null,
    managerIds: team.managerIds.map((managerId) => managerId.toString()),
    attendancePolicyId: id(team.attendancePolicyId),
    isActive: team.isActive,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export function serializePolicyHistory(history: ITeamPolicyHistory) {
  return {
    id: history._id.toString(),
    teamId: id(history.teamId),
    previousPolicyId: id(history.previousPolicyId),
    previousPolicyName: history.previousPolicyName ?? null,
    newPolicyId: id(history.newPolicyId),
    newPolicyName: history.newPolicyName,
    changedBy: id(history.changedBy),
    changedAt: history.changedAt,
    reason: history.reason ?? null,
  };
}

/**
 * 근태 기록. `policy` 는 기록에 박힌 스냅샷에서 계산한 "당시 기준"이다.
 * 현재 정책이 아니라 그 기록이 판정된 기준을 그대로 보여준다.
 */
export function serializeRecord(record: IAttendanceRecord) {
  return {
    id: record._id.toString(),
    userId: id(record.userId),
    teamId: id(record.teamId),
    workDate: record.workDate,
    clockInAt: record.clockInAt ?? null,
    clockOutAt: record.clockOutAt ?? null,
    status: record.status,
    workedMinutes: record.workedMinutes,
    isLate: record.isLate,
    lateMinutes: record.lateMinutes,
    isEarlyLeave: record.isEarlyLeave,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    appliedPolicyId: id(record.appliedPolicyId),
    policy: describeCriteria(record.policySnapshot),
  };
}

/** 팀·전사 조회에서는 누구의 기록인지 함께 내려준다. */
export function serializeRecordWithUser(
  record: IAttendanceRecord,
  user: Pick<IUser, "_id" | "name" | "email" | "employeeNumber"> | null,
) {
  return {
    ...serializeRecord(record),
    user: user
      ? {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          employeeNumber: user.employeeNumber ?? null,
        }
      : null,
  };
}
