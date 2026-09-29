import type { NextRequest } from "next/server";

import { ok, route } from "@/lib/api/response";
import { objectIdSchema, paginationSchema, parseQuery } from "@/lib/api/validation";
import { serializePolicyHistory } from "@/lib/api/serializers";
import { assertTeamReadAccess, requireUser } from "@/lib/auth/guard";
import { TeamPolicyHistory } from "@/lib/db/models";

type Context = { params: Promise<{ teamId: string }> };

/**
 * GET /api/teams/{teamId}/policy-history — 정책 변경 이력 (HR 관리자, 해당 팀 관리자).
 * 최신 변경이 먼저 온다.
 */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const user = await requireUser();
  const { teamId } = await params;
  const id = objectIdSchema.parse(teamId);

  await assertTeamReadAccess(user, id);

  const { page, limit } = parseQuery(request, paginationSchema);
  const filter = { teamId: id };

  const [items, total] = await Promise.all([
    TeamPolicyHistory.find(filter)
      .sort({ changedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TeamPolicyHistory.countDocuments(filter),
  ]);

  return ok({ items: items.map(serializePolicyHistory), total, page, limit });
});
