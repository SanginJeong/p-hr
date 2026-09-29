import { created, route } from "@/lib/api/response";
import { serializeRecord } from "@/lib/api/serializers";
import { requireUser } from "@/lib/auth/guard";
import { clockIn } from "@/lib/attendance/service";

/**
 * POST /api/attendance/clock-in — 출근 기록.
 * 팀에 적용된 정책을 스냅샷으로 박고, 그 기준으로 지각을 판정한다.
 */
export const POST = route(async () => {
  const user = await requireUser();
  const record = await clockIn(user);

  return created({ record: serializeRecord(record) });
});
