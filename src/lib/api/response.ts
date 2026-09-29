import { NextResponse } from "next/server";
import { ZodError } from "zod";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/mongodb";
import { ApiError } from "./errors";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true as const, data }, { status });
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return ok(data, 201);
}

function failure(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false as const, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function isDuplicateKeyError(error: unknown): error is { code: number; keyValue: object } {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/** 던져진 에러를 일관된 실패 응답으로 바꾼다. 예상하지 못한 에러는 내부 메시지를 노출하지 않는다. */
export function toErrorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof ApiError) {
    return failure(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return failure(400, "VALIDATION_ERROR", "요청 형식이 올바르지 않습니다.", error.issues);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(error.errors).map(([path, err]) => [path, err.message]),
    );
    return failure(400, "VALIDATION_ERROR", "저장할 수 없는 값이 있습니다.", details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return failure(400, "INVALID_ID", "식별자 형식이 올바르지 않습니다.");
  }

  if (isDuplicateKeyError(error)) {
    return failure(409, "DUPLICATE_KEY", "이미 존재하는 값입니다.", error.keyValue);
  }

  console.error("처리하지 못한 API 에러:", error);
  return failure(500, "INTERNAL_ERROR", "서버 내부 오류가 발생했습니다.");
}

/**
 * 모든 라우트 핸들러를 감싼다. DB 연결과 에러 변환을 한곳에서 처리한다.
 * 핸들러는 성공 응답만 만들고, 실패는 throw 하면 된다.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      await connectDB();
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
