"use client";

import { useEffect } from "react";

/** jsDelivr 의 5.x 최신 빌드. 번들에 포함하지 않고 CDN 에서 불러온다. */
const SWAGGER_UI_CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5";

declare global {
  interface Window {
    SwaggerUIBundle?: (options: Record<string, unknown>) => void;
  }
}

/**
 * /api-docs — Swagger UI. 문서는 /api/openapi 에서 읽는다.
 * withCredentials 를 켜야 "Try it out" 이 세션 쿠키를 함께 보낸다(로그인 후 그대로 호출 가능).
 */
export default function ApiDocsPage() {
  useEffect(() => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `${SWAGGER_UI_CDN}/swagger-ui.css`;
    document.head.appendChild(stylesheet);

    const script = document.createElement("script");
    script.src = `${SWAGGER_UI_CDN}/swagger-ui-bundle.js`;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.SwaggerUIBundle?.({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        docExpansion: "list",
        tryItOutEnabled: true,
        withCredentials: true,
        persistAuthorization: true,
      });
    };
    document.body.appendChild(script);

    return () => {
      stylesheet.remove();
      script.remove();
    };
  }, []);

  return <div id="swagger-ui" />;
}
