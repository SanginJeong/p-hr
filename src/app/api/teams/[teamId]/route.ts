import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/response";
import { objectIdSchema, parseBody } from "@/lib/api/validation";
import { serializeTeam } from "@/lib/api/serializers";
import { assertTeamVisibility, requireHrAdmin, requireUser } from "@/lib/auth/guard";
import { Team } from "@/lib/db/models";

type Context = { params: Promise<{ teamId: string }> };

const updateTeamSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    managerIds: z.array(objectIdSchema).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "수정할 항목이 없습니다." });

async function findTeam(teamId: string) {
  const team = await Team.findById(objectIdSchema.parse(teamId));

  if (!team) {
    throw notFound("팀을 찾을 수 없습니다.");
  }

  return team;
}

/** GET /api/teams/{teamId} — 팀 상세. HR 관리자, 해당 팀 관리자, 소속 팀원이 볼 수 있다. */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  const user = await requireUser();
  const { teamId } = await params;

  await assertTeamVisibility(user, objectIdSchema.parse(teamId));

  return ok({ team: serializeTeam(await findTeam(teamId)) });
});

/** PATCH /api/teams/{teamId} — 팀 정보 수정 (HR 관리자). 정책 변경은 PUT .../policy 를 쓴다. */
export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  await requireHrAdmin();

  const { teamId } = await params;
  const body = await parseBody(request, updateTeamSchema);
  const team = await findTeam(teamId);

  if (body.name !== undefined) team.name = body.name;
  if (body.description !== undefined) team.description = body.description ?? undefined;
  if (body.managerIds !== undefined) {
    team.managerIds = body.managerIds.map((id) => new Types.ObjectId(id));
  }
  if (body.isActive !== undefined) team.isActive = body.isActive;

  await team.save();

  return ok({ team: serializeTeam(team) });
});
