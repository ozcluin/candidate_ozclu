/**
 * Shared Security Headers Module.
 *
 * Provides security header constants for use in next.config.ts and middleware.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Security headers applied to all routes.
 */
export const GLOBAL_SECURITY_HEADERS: SecurityHeader[] = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
];

/**
 * CSP header — adjust per portal needs.
 * Uses 'unsafe-inline' for Next.js style injection compatibility.
 */
export const CSP_HEADER: SecurityHeader = {
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

/**
 * HSTS header — only add in production.
 */
export const HSTS_HEADER: SecurityHeader = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
};

/**
 * Headers for sensitive API responses (KYC, PII, auth).
 */
export const SENSITIVE_RESPONSE_HEADERS: SecurityHeader[] = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
  {
    key: "Expires",
    value: "0",
  },
];

/**
 * Build the full headers array for next.config.ts.
 */
export function buildNextConfigHeaders(isProduction: boolean): SecurityHeader[] {
  const headers = [...GLOBAL_SECURITY_HEADERS, CSP_HEADER];
  if (isProduction) {
    headers.push(HSTS_HEADER);
  }
  return headers;
}
