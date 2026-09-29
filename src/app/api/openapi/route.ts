import { NextResponse } from "next/server";

import { openApiDocument } from "@/lib/api/openapi";

/** GET /api/openapi — OpenAPI 3.1 문서. /api-docs 의 Swagger UI 가 이 응답을 읽는다. */
export function GET() {
  return NextResponse.json(openApiDocument);
}
