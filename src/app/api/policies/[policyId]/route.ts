import type { NextRequest } from "next/server";
import { z } from "zod";

import { conflict, notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/response";
import { objectIdSchema, parseBody } from "@/lib/api/validation";
import { serializePolicy } from "@/lib/api/serializers";
import { requireHrAdmin } from "@/lib/auth/guard";
import { AttendancePolicy } from "@/lib/db/models";

type Context = { params: Promise<{ policyId: string }> };

/**
 * 이름과 설명만 수정할 수 있다.
 * 근무 규칙을 바꾸려면 새 정책을 만들어 팀에 적용한다 — 그래야 변경 이력이 남고,
 * 어떤 기준으로 판정했는지 정책 목록만 보고도 알 수 있다.
 */
const updatePolicySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "수정할 항목이 없습니다." });

async function findPolicy(policyId: string) {
  const policy = await AttendancePolicy.findById(objectIdSchema.parse(policyId));

  if (!policy) {
    throw notFound("근태 정책을 찾을 수 없습니다.");
  }

  return policy;
}

/** GET /api/policies/{policyId} — 정책 상세 (HR 관리자). */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  await requireHrAdmin();

  const { policyId } = await params;

  return ok({ policy: serializePolicy(await findPolicy(policyId)) });
});

/** PATCH /api/policies/{policyId} — 이름·설명 수정 (HR 관리자). */
export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  await requireHrAdmin();

  const { policyId } = await params;
  const body = await parseBody(request, updatePolicySchema);
  const policy = await findPolicy(policyId);

  if (body.name !== undefined) policy.name = body.name;
  if (body.description !== undefined) policy.description = body.description ?? undefined;

  await policy.save();

  return ok({ policy: serializePolicy(policy) });
});

/**
 * DELETE /api/policies/{policyId} — 정책 삭제 (HR 관리자).
 * 팀에서 사용 중이거나 과거 근태 기록이 참조하는 정책은 409 로 거부한다.
 */
export const DELETE = route(async (_request: NextRequest, { params }: Context) => {
  await requireHrAdmin();

  const { policyId } = await params;
  const policy = await findPolicy(policyId);

  try {
    await AttendancePolicy.assertDeletable(policy._id);
  } catch (error) {
    throw conflict("POLICY_IN_USE", (error as Error).message);
  }

  await AttendancePolicy.deleteOne({ _id: policy._id });

  return ok({ deleted: true, id: policy._id.toString() });
});
