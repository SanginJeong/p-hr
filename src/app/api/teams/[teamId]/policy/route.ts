import type { NextRequest } from "next/server";
import { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/response";
import { objectIdSchema, parseBody } from "@/lib/api/validation";
import { serializePolicy, serializePolicyHistory, serializeTeam } from "@/lib/api/serializers";
import { assertTeamVisibility, requireHrAdmin } from "@/lib/auth/guard";
import { requireUser } from "@/lib/auth/guard";
import { describeCriteria } from "@/lib/attendance/policy-engine";
import { toSnapshot } from "@/lib/attendance/service";
import { AttendancePolicy, Team, TeamPolicyHistory } from "@/lib/db/models";

type Context = { params: Promise<{ teamId: string }> };

const applyPolicySchema = z.object({
  policyId: objectIdSchema,
  reason: z.string().max(500).optional(),
});

async function findTeam(teamId: string) {
  const team = await Team.findById(objectIdSchema.parse(teamId));

  if (!team) {
    throw notFound("팀을 찾을 수 없습니다.");
  }

  return team;
}

/**
 * GET /api/teams/{teamId}/policy — 팀에 적용된 현재 근태 정책.
 * HR 관리자, 해당 팀 관리자, 소속 팀원이 볼 수 있다. 미설정이면 null 을 준다.
 */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  const user = await requireUser();
  const { teamId } = await params;

  await assertTeamVisibility(user, objectIdSchema.parse(teamId));

  const team = await findTeam(teamId);
  const policy = team.attendancePolicyId
    ? await AttendancePolicy.findById(team.attendancePolicyId)
    : null;

  return ok({
    teamId: team._id.toString(),
    policy: policy ? serializePolicy(policy) : null,
    criteria: policy ? describeCriteria(toSnapshot(policy)) : null,
  });
});

/**
 * PUT /api/teams/{teamId}/policy — 팀 정책 변경 (HR 관리자).
 * 변경 즉시 이후 생성되는 근태 기록에 적용된다. 이미 생성된 기록은 자기 스냅샷을 유지한다.
 * 변경 이력(TeamPolicyHistory)은 팀 갱신이 성공한 뒤에 기록한다.
 */
export const PUT = route(async (request: NextRequest, { params }: Context) => {
  const admin = await requireHrAdmin();
  const { teamId } = await params;
  const body = await parseBody(request, applyPolicySchema);

  const team = await findTeam(teamId);
  const policy = await AttendancePolicy.findById(body.policyId);

  if (!policy) {
    throw notFound("근태 정책을 찾을 수 없습니다.");
  }

  if (team.attendancePolicyId && team.attendancePolicyId.equals(policy._id)) {
    throw conflict("SAME_POLICY", "이미 이 팀에 적용된 정책입니다.");
  }

  const previousPolicy = team.attendancePolicyId
    ? await AttendancePolicy.findById(team.attendancePolicyId)
    : null;

  team.attendancePolicyId = policy._id;
  await team.save();

  const history = await TeamPolicyHistory.create({
    teamId: team._id,
    previousPolicyId: previousPolicy?._id ?? null,
    previousPolicyName: previousPolicy?.name ?? null,
    newPolicyId: policy._id,
    newPolicyName: policy.name,
    changedBy: admin.id,
    changedAt: new Date(),
    reason: body.reason,
  });

  return ok({
    team: serializeTeam(team),
    policy: serializePolicy(policy),
    criteria: describeCriteria(toSnapshot(policy)),
    history: serializePolicyHistory(history),
  });
});
