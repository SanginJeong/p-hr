import type { NextRequest } from "next/server";

import { ok, route } from "@/lib/api/response";
import { dateRangeSchema, paginationSchema, parseQuery } from "@/lib/api/validation";
import { requireUser } from "@/lib/auth/guard";
import { findAttendanceRecords } from "@/lib/attendance/queries";

const querySchema = paginationSchema.and(dateRangeSchema);

/**
 * GET /api/attendance/me — 내 일별 근태 기록.
 * userId 를 바꿔 넣을 수 없다. 다른 사람의 기록은 이 엔드포인트로 볼 수 없다.
 */
export const GET = route(async (request: NextRequest) => {
  const user = await requireUser();
  const query = parseQuery(request, querySchema);

  return ok(await findAttendanceRecords({ ...query, userId: user.id }));
});
