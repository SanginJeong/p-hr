import type { NextRequest } from "next/server";

import { ok, route } from "@/lib/api/response";
import {
  dateRangeSchema,
  objectIdSchema,
  paginationSchema,
  parseQuery,
} from "@/lib/api/validation";
import { assertTeamReadAccess, requireUser } from "@/lib/auth/guard";
import { findAttendanceRecords } from "@/lib/attendance/queries";

type Context = { params: Promise<{ teamId: string }> };

const querySchema = paginationSchema.extend({
  userId: objectIdSchema.optional(),
}).and(dateRangeSchema);

/**
 * GET /api/teams/{teamId}/attendance — 팀원 근태 기록 (HR 관리자, 해당 팀 관리자).
 * 기간(from·to)과 특정 팀원(userId)으로 좁힐 수 있다.
 */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const user = await requireUser();
  const { teamId } = await params;
  const id = objectIdSchema.parse(teamId);

  await assertTeamReadAccess(user, id);

  const query = parseQuery(request, querySchema);

  return ok(await findAttendanceRecords({ ...query, teamId: id }));
});
