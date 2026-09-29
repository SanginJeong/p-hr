import { Types } from "mongoose";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest, notFound } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/response";
import { objectIdSchema, parseBody } from "@/lib/api/validation";
import { serializeUser } from "@/lib/api/serializers";
import { requireHrAdmin } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { USER_ROLES, User } from "@/lib/db/models";

type Context = { params: Promise<{ userId: string }> };

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    role: z.enum(USER_ROLES).optional(),
    teamId: objectIdSchema.nullable().optional(),
    employeeNumber: z.string().max(30).nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "수정할 항목이 없습니다." });

/** GET /api/users/{userId} — 구성원 상세 (HR 관리자). */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  await requireHrAdmin();

  const { userId } = await params;
  const user = await User.findById(objectIdSchema.parse(userId));

  if (!user) {
    throw notFound("사용자를 찾을 수 없습니다.");
  }

  return ok({ user: serializeUser(user) });
});

/**
 * PATCH /api/users/{userId} — 구성원 수정 (HR 관리자).
 * 팀 이동·역할 변경·퇴사 처리(isActive=false)·비밀번호 재설정을 처리한다.
 */
export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  await requireHrAdmin();

  const { userId } = await params;
  const body = await parseBody(request, updateUserSchema);
  const user = await User.findById(objectIdSchema.parse(userId));

  if (!user) {
    throw notFound("사용자를 찾을 수 없습니다.");
  }

  if (body.name !== undefined) user.name = body.name;
  if (body.role !== undefined) user.role = body.role;
  if (body.teamId !== undefined) {
    user.teamId = body.teamId ? new Types.ObjectId(body.teamId) : null;
  }
  if (body.employeeNumber !== undefined) user.employeeNumber = body.employeeNumber;
  if (body.isActive !== undefined) user.isActive = body.isActive;
  if (body.password !== undefined) user.passwordHash = await hashPassword(body.password);

  if (user.role !== "HR_ADMIN" && !user.teamId) {
    throw badRequest("HR 관리자를 제외한 구성원은 소속 팀이 필요합니다.");
  }

  await user.save();

  return ok({ user: serializeUser(user) });
});
