import type { QueryFilter } from "mongoose";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { created, ok, route } from "@/lib/api/response";
import { paginationSchema, parseBody, parseQuery } from "@/lib/api/validation";
import { serializePolicy } from "@/lib/api/serializers";
import { requireHrAdmin } from "@/lib/auth/guard";
import {
  AttendancePolicy,
  POLICY_TYPES,
  TIME_PATTERN,
  type IAttendancePolicy,
} from "@/lib/db/models";

const timeSchema = z.string().regex(TIME_PATTERN, "시각은 HH:mm 형식이어야 합니다.");

const commonFields = {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  workDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  timezone: z.string().min(1).optional(),
  breakTimes: z.array(z.object({ startTime: timeSchema, endTime: timeSchema })).optional(),
};

/**
 * 유형별로 필요한 설정이 다르므로 discriminated union 으로 받는다.
 * 시각의 순서·코어타임 짝 맞춤 같은 교차 검증은 스키마(validator)가 다시 확인한다.
 */
const createPolicySchema = z.discriminatedUnion("type", [
  z.object({
    ...commonFields,
    type: z.literal("FIXED"),
    fixed: z.object({
      workStartTime: timeSchema,
      workEndTime: timeSchema,
      lateGraceMinutes: z.number().int().min(0).max(1440).default(0),
    }),
  }),
  z.object({
    ...commonFields,
    type: z.literal("FLEXIBLE"),
    flexible: z.object({
      clockInStartTime: timeSchema,
      clockInEndTime: timeSchema,
      dailyRequiredMinutes: z.number().int().min(1).max(1440),
      coreTimeStartTime: timeSchema.nullish(),
      coreTimeEndTime: timeSchema.nullish(),
    }),
  }),
]);

const listQuerySchema = paginationSchema.extend({ type: z.enum(POLICY_TYPES).optional() });

/** GET /api/policies — 근태 정책 목록 (HR 관리자). */
export const GET = route(async (request: NextRequest) => {
  await requireHrAdmin();

  const { page, limit, type } = parseQuery(request, listQuerySchema);
  const filter: QueryFilter<IAttendancePolicy> = {};

  if (type) filter.type = type;

  const [policies, total] = await Promise.all([
    AttendancePolicy.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AttendancePolicy.countDocuments(filter),
  ]);

  return ok({ items: policies.map(serializePolicy), total, page, limit });
});

/** POST /api/policies — 근태 정책 생성 (HR 관리자). */
export const POST = route(async (request: NextRequest) => {
  const admin = await requireHrAdmin();
  const body = await parseBody(request, createPolicySchema);

  const policy = await AttendancePolicy.create({
    name: body.name,
    description: body.description,
    type: body.type,
    workDays: body.workDays,
    timezone: body.timezone,
    breakTimes: body.breakTimes ?? [],
    fixed: body.type === "FIXED" ? body.fixed : null,
    flexible: body.type === "FLEXIBLE" ? body.flexible : null,
    createdBy: admin.id,
  });

  return created({ policy: serializePolicy(policy) });
});
