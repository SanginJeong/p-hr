import { ok, route } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guard";
import { serializeTeam, serializeUser } from "@/lib/api/serializers";
import { describeCriteria } from "@/lib/attendance/policy-engine";
import { toSnapshot } from "@/lib/attendance/service";
import { AttendancePolicy, Team, User } from "@/lib/db/models";

/**
 * GET /api/auth/me — 내 정보 + 소속 팀 + 팀에 적용된 근태 정책 기준.
 * 정책이 없으면 policy 는 null 이다(에러가 아니다).
 */
export const GET = route(async () => {
  const current = await requireUser();
  const user = await User.findById(current.id);
  const team = current.teamId ? await Team.findById(current.teamId) : null;
  const policy = team?.attendancePolicyId
    ? await AttendancePolicy.findById(team.attendancePolicyId)
    : null;

  return ok({
    user: user ? serializeUser(user) : null,
    team: team ? serializeTeam(team) : null,
    policy: policy ? describeCriteria(toSnapshot(policy)) : null,
  });
});
