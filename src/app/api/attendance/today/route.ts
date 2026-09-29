import { ok, route } from "@/lib/api/response";
import { serializeRecord } from "@/lib/api/serializers";
import { requireUser } from "@/lib/auth/guard";
import { currentWorkDate, describeCriteria, isWorkDay } from "@/lib/attendance/policy-engine";
import { toSnapshot } from "@/lib/attendance/service";
import {
  AttendancePolicy,
  AttendanceRecord,
  DEFAULT_TIMEZONE,
  Team,
} from "@/lib/db/models";

/**
 * GET /api/attendance/today — 오늘의 내 근태.
 * 정책이 없거나 소속 팀이 없어도 200 으로 응답하고 policy 를 null 로 내려준다(화면이 안내를 띄울 수 있게).
 * openRecord 는 아직 퇴근하지 않은 기록이다(자정을 넘긴 근무라면 어제 날짜일 수 있다).
 */
export const GET = route(async () => {
  const user = await requireUser();

  const team = user.teamId ? await Team.findById(user.teamId) : null;
  const policy = team?.attendancePolicyId
    ? await AttendancePolicy.findById(team.attendancePolicyId)
    : null;

  const snapshot = policy ? toSnapshot(policy) : null;
  const timezone = snapshot?.timezone ?? DEFAULT_TIMEZONE;
  const workDate = currentWorkDate(timezone);

  const [record, openRecord] = await Promise.all([
    AttendanceRecord.findOne({ userId: user.id, workDate }),
    AttendanceRecord.findOne({
      userId: user.id,
      clockInAt: { $ne: null },
      clockOutAt: null,
    }).sort({ workDate: -1 }),
  ]);

  return ok({
    workDate,
    timezone,
    isWorkDay: snapshot ? isWorkDay(snapshot, workDate) : null,
    teamId: team ? team._id.toString() : null,
    policy: snapshot ? describeCriteria(snapshot) : null,
    record: record ? serializeRecord(record) : null,
    openRecord: openRecord ? serializeRecord(openRecord) : null,
  });
});
