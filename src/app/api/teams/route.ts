import type { NextRequest } from "next/server";
import { z } from "zod";

import { created, ok, route } from "@/lib/api/response";
import { objectIdSchema, paginationSchema, parseBody, parseQuery } from "@/lib/api/validation";
import { serializeTeam } from "@/lib/api/serializers";
import { requireHrAdmin } from "@/lib/auth/guard";
import { Team } from "@/lib/db/models";

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  managerIds: z.array(objectIdSchema).default([]),
  attendancePolicyId: objectIdSchema.nullish(),
});

/** GET /api/teams — 팀 목록 (HR 관리자). */
export const GET = route(async (request: NextRequest) => {
  await requireHrAdmin();

  const { page, limit } = parseQuery(request, paginationSchema);
  const [teams, total] = await Promise.all([
    Team.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Team.countDocuments(),
  ]);

  return ok({ items: teams.map(serializeTeam), total, page, limit });
});

/** POST /api/teams — 팀 생성 (HR 관리자). 정책은 생성 시 지정하거나 이후 PUT 으로 적용한다. */
export const POST = route(async (request: NextRequest) => {
  await requireHrAdmin();

  const body = await parseBody(request, createTeamSchema);
  const team = await Team.create({
    name: body.name,
    description: body.description,
    managerIds: body.managerIds,
    attendancePolicyId: body.attendancePolicyId ?? null,
  });

  return created({ team: serializeTeam(team) });
});
