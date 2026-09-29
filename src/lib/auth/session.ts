import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { UserRole } from "@/lib/db/models/constants";

export const SESSION_COOKIE = "hr_session";

/** 7일 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  /** 사용자 _id */
  sub: string;
  role: UserRole;
  /** 발급 시각 (초) */
  iat: number;
  /** 만료 시각 (초) */
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 환경 변수가 없거나 너무 짧습니다(32자 이상 필요).");
  }

  return secret;
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const signature = (data: string) =>
  createHmac("sha256", getSecret()).update(data).digest("base64url");

/** HS256 JWT 를 직접 발급한다(외부 의존성 없음). */
export function signSessionToken(sub: string, role: UserRole): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub,
    role,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  };

  const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;

  return `${data}.${signature(data)}`;
}

/** 서명과 만료를 검증한다. 유효하지 않으면 null. */
export function verifySessionToken(token: string): SessionPayload | null {
  const [header, payload, mac] = token.split(".");

  if (!header || !payload || !mac) {
    return null;
  }

  const expected = Buffer.from(signature(`${header}.${payload}`));
  const actual = Buffer.from(mac);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;

    return parsed.exp > Math.floor(Date.now() / 1000) ? parsed : null;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function readSessionPayload(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  return token ? verifySessionToken(token) : null;
}
