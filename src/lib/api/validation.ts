import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest } from "./errors";
import { DATE_PATTERN } from "@/lib/db/models/constants";

/** 요청 본문을 스키마로 검증한다. 본문이 JSON 이 아니면 400. */
export async function parseBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw badRequest("요청 본문이 올바른 JSON 이 아닙니다.");
  }

  return schema.parse(raw);
}

/** 쿼리스트링을 스키마로 검증한다. */
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

/** 목록 조회 공통 페이지네이션. limit 은 100 을 넘지 못한다. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "올바른 식별자가 아닙니다.");

export const workDateSchema = z.string().regex(DATE_PATTERN, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

/** 기간 조회 파라미터. from 이 to 보다 늦으면 거부한다. */
export const dateRangeSchema = z
  .object({ from: workDateSchema.optional(), to: workDateSchema.optional() })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from 은 to 보다 이전이어야 합니다.",
    path: ["from"],
  });
