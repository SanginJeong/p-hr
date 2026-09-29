import type { NextRequest } from "next/server";
import { z } from "zod";

import { conflict } from "@/lib/api/errors";
import { created, route } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";
import { serializeUser } from "@/lib/api/serializers";
import { hashPassword } from "@/lib/auth/password";
import { User } from "@/lib/db/models";

const bootstrapSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().min(1).max(50),
});

/**
 * POST /api/auth/bootstrap — 최초 HR 관리자 1명을 만든다.
 * 사용자가 한 명이라도 있으면 항상 409. 이후 계정 생성은 POST /api/users 로만 가능하다.
 */
export const POST = route(async (request: NextRequest) => {
  const body = await parseBody(request, bootstrapSchema);

  if ((await User.countDocuments()) > 0) {
    throw conflict("ALREADY_BOOTSTRAPPED", "이미 사용자가 존재합니다.");
  }

  const user = await User.create({
    email: body.email,
    passwordHash: await hashPassword(body.password),
    name: body.name,
    role: "HR_ADMIN",
  });

  return created({ user: serializeUser(user) });
});
