import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const isProduction = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  try {
    const simulate = process.env.SIMULATE_DIGILOCKER === "true";
    const clientId = process.env.DIGILOCKER_CLIENT_ID || "";
    const callbackUrl = process.env.DIGILOCKER_CALLBACK_URL || "";

    // SECURITY: Hard-block mock mode in production
    if (isProduction && simulate) {
      console.error("[DigiLocker] FATAL: SIMULATE_DIGILOCKER=true is not allowed in production.");
      return NextResponse.json({ error: "DigiLocker mock mode is disabled in production." }, { status: 403 });
    }

    // Validate required credentials
    if (!simulate && (!clientId || !callbackUrl)) {
      console.error("[DigiLocker] Missing DIGILOCKER_CLIENT_ID or DIGILOCKER_CALLBACK_URL.");
      return NextResponse.json({ error: "DigiLocker configuration is incomplete." }, { status: 500 });
    }

    // SECURITY: Block localhost callback URLs in production
    if (isProduction && (callbackUrl.includes("localhost") || callbackUrl.includes("127.0.0.1"))) {
      console.error("[DigiLocker] FATAL: DIGILOCKER_CALLBACK_URL contains localhost in production.");
      return NextResponse.json({ error: "Invalid DigiLocker callback URL for production." }, { status: 500 });
    }

    const state = crypto.randomBytes(16).toString("hex");

    if (simulate) {
      // Redirect to mock DigiLocker UI (development only)
      const mockAuthUrl = `/candidate/mock-digilocker?state=${state}&client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
      return NextResponse.redirect(new URL(mockAuthUrl, req.url));
    } else {
      const nonce = crypto.randomBytes(16).toString("hex");
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Set PKCE cookies
      const cookieStore = await cookies();
      cookieStore.set("code_verifier", codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60, // 10 minutes
        path: "/",
        sameSite: "lax",
      });
      cookieStore.set("nonce", nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60,
        path: "/",
        sameSite: "lax",
      });

      // Redirect to real DigiLocker OAuth URL using PKCE
      const baseUrl = "https://digilocker.meripehchaan.gov.in/public";
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        state: state,
        scope: "openid",
        nonce: nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        acr: "aadhaar pan driving_licence"
      });

      const realAuthUrl = `${baseUrl}/oauth2/1/authorize?${params.toString()}`;
      console.log("[DigiLocker] Redirecting to authorization URL.");
      return NextResponse.redirect(realAuthUrl);
    }
  } catch (error: any) {
    console.error("[DigiLocker] Authorization redirect error:", error.message);
    return NextResponse.json({ error: "Failed to initiate DigiLocker redirect" }, { status: 500 });
  }
}

