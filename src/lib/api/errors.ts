/** API 경계에서 사용하는 에러 타입. HTTP 상태와 기계가 읽는 코드를 함께 들고 다닌다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "로그인이 필요합니다.") =>
  new ApiError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "권한이 없습니다.") =>
  new ApiError(403, "FORBIDDEN", message);

export const notFound = (message = "대상을 찾을 수 없습니다.") =>
  new ApiError(404, "NOT_FOUND", message);

export const conflict = (code: string, message: string) => new ApiError(409, code, message);
