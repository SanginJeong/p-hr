import { ok, route } from "@/lib/api/response";
import { clearSessionCookie } from "@/lib/auth/session";

/** POST /api/auth/logout — 세션 쿠키를 만료시킨다. 로그인 여부와 무관하게 성공한다. */
export const POST = route(async () => {
  await clearSessionCookie();

  return ok({ loggedOut: true });
});
