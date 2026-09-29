import type { QueryFilter } from "mongoose";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { created, ok, route } from "@/lib/api/response";
import { objectIdSchema, paginationSchema, parseBody, parseQuery } from "@/lib/api/validation";
import { serializeUser } from "@/lib/api/serializers";
import { requireHrAdmin } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { USER_ROLES, User, type IUser } from "@/lib/db/models";

const listQuerySchema = paginationSchema.extend({
  teamId: objectIdSchema.optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().min(1).max(50),
  role: z.enum(USER_ROLES).default("EMPLOYEE"),
  teamId: objectIdSchema.nullish(),
  employeeNumber: z.string().max(30).nullish(),
});

/** GET /api/users — 구성원 목록 (HR 관리자). */
export const GET = route(async (request: NextRequest) => {
  await requireHrAdmin();

  const { page, limit, teamId, role, isActive } = parseQuery(request, listQuerySchema);
  const filter: QueryFilter<IUser> = {};

  if (teamId) filter.teamId = teamId;
  if (role) filter.role = role;
  if (isActive) filter.isActive = isActive === "true";

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return ok({ items: users.map(serializeUser), total, page, limit });
});

/** POST /api/users — 구성원 생성 (HR 관리자). 비밀번호는 scrypt 해시로만 저장된다. */
export const POST = route(async (request: NextRequest) => {
  await requireHrAdmin();

  const body = await parseBody(request, createUserSchema);
  const user = await User.create({
    email: body.email,
    passwordHash: await hashPassword(body.password),
    name: body.name,
    role: body.role,
    teamId: body.teamId ?? null,
    employeeNumber: body.employeeNumber ?? null,
  });

  return created({ user: serializeUser(user) });
});
