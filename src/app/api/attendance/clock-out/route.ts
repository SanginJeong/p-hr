import { ok, route } from "@/lib/api/response";
import { serializeRecord } from "@/lib/api/serializers";
import { requireUser } from "@/lib/auth/guard";
import { clockOut } from "@/lib/attendance/service";

/**
 * POST /api/attendance/clock-out — 퇴근 기록.
 * 기록에 박힌 스냅샷으로 실근무시간·조기퇴근을 계산한다(현재 정책이 아니다).
 */
export const POST = route(async () => {
  const user = await requireUser();
  const record = await clockOut(user);

  return ok({ record: serializeRecord(record) });
});
