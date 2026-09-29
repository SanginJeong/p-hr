import type { NextRequest } from "next/server";

import { ok, route } from "@/lib/api/response";
import {
  dateRangeSchema,
  objectIdSchema,
  paginationSchema,
  parseQuery,
} from "@/lib/api/validation";
import { requireHrAdmin } from "@/lib/auth/guard";
import { findAttendanceRecords } from "@/lib/attendance/queries";

const querySchema = paginationSchema
  .extend({
    teamId: objectIdSchema.optional(),
    userId: objectIdSchema.optional(),
  })
  .and(dateRangeSchema);

/**
 * GET /api/attendance — 전체 팀 근태 기록 (HR 관리자).
 * summary 로 필터 전체의 실근무시간 합계와 지각 건수를 함께 준다.
 */
export const GET = route(async (request: NextRequest) => {
  await requireHrAdmin();

  const query = parseQuery(request, querySchema);

  return ok(await findAttendanceRecords(query));
});
