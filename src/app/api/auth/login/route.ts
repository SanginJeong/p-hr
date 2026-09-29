import type { NextRequest } from "next/server";
import { z } from "zod";

import { unauthorized } from "@/lib/api/errors";
import { ok, route } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";
import { serializeUser } from "@/lib/api/serializers";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, signSessionToken } from "@/lib/auth/session";
import { User } from "@/lib/db/models";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** POST /api/auth/login — 로그인. 세션 쿠키(httpOnly)를 내려준다. */
export const POST = route(async (request: NextRequest) => {
  const { email, password } = await parseBody(request, loginSchema);

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");

  // 존재하지 않는 계정과 비밀번호 불일치를 구분해서 알려주지 않는다.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  if (!user.isActive) {
    throw unauthorized("비활성화된 계정입니다.");
  }

  await setSessionCookie(signSessionToken(user._id.toString(), user.role));

  return ok({ user: serializeUser(user) });
});
