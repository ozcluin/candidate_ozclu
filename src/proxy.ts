import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GLOBAL_SECURITY_HEADERS, CSP_HEADER, HSTS_HEADER, SENSITIVE_RESPONSE_HEADERS } from "./shared/securityHeaders";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Add global security headers
  for (const header of GLOBAL_SECURITY_HEADERS) {
    response.headers.set(header.key, header.value);
  }

  // Add CSP header
  response.headers.set(CSP_HEADER.key, CSP_HEADER.value);

  // Add HSTS in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(HSTS_HEADER.key, HSTS_HEADER.value);
  }

  // Add Cache-Control no-store on sensitive API/KYC routes
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") || path.includes("/kyc/") || path.includes("/verification-detail")) {
    for (const header of SENSITIVE_RESPONSE_HEADERS) {
      response.headers.set(header.key, header.value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Apply proxy to all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
