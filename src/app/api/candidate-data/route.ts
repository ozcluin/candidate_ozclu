import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireRole,
  isErrorResponse,
  sanitizeVerification,
} from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { encrypt, decryptOrPassthrough, maskAadhaar } from "shared/encryption";

export async function GET(req: NextRequest) {
  try {
    // ── Auth: require authenticated candidate session ──
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["candidate"]);
    if (roleError) return roleError;

    const email = user.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Invalid session email" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Use session email as source of truth — never trust request body/query
    const verification = await db.collection("verifications").findOne(
      { email },
      { projection: { tempPassword: 0, password: 0 } }
    );

    if (!verification) {
      return NextResponse.json({ error: "No verification request found for this email" }, { status: 404 });
    }

    // Check if candidate verification is complete and has expired (24 hours after completion)
    if (verification.status === "Completed" && verification.completedAt) {
      const completedTime = new Date(verification.completedAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - completedTime > twentyFourHours) {
        return NextResponse.json({ error: "Your access has expired. Candidate login is deactivated 24 hours after verification completion." }, { status: 403 });
      }
    }

    // Decrypt fields if encrypted before returning to client
    const cleanVerification = { ...verification };
    if (cleanVerification.aadhaarNumber) {
      cleanVerification.aadhaarNumber = decryptOrPassthrough(cleanVerification.aadhaarNumber);
    }
    if (cleanVerification.dob) {
      cleanVerification.dob = decryptOrPassthrough(cleanVerification.dob);
    }
    if (cleanVerification.digilockerAadhaar) {
      cleanVerification.digilockerAadhaar = decryptOrPassthrough(cleanVerification.digilockerAadhaar);
    }
    if (cleanVerification.digilockerPan) {
      cleanVerification.digilockerPan = decryptOrPassthrough(cleanVerification.digilockerPan);
    }
    if (cleanVerification.digilockerDrivingLicence) {
      cleanVerification.digilockerDrivingLicence = decryptOrPassthrough(cleanVerification.digilockerDrivingLicence);
    }
    if (cleanVerification.digilockerDob) {
      cleanVerification.digilockerDob = decryptOrPassthrough(cleanVerification.digilockerDob);
    }
    if (cleanVerification.digilockerId) {
      cleanVerification.digilockerId = decryptOrPassthrough(cleanVerification.digilockerId);
    }
    if (cleanVerification.digilockerReferenceKey) {
      cleanVerification.digilockerReferenceKey = decryptOrPassthrough(cleanVerification.digilockerReferenceKey);
    }

    return NextResponse.json({ verification: sanitizeVerification(cleanVerification) });
  } catch (error: any) {
    console.error("[DATA] Candidate GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch candidate data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: require authenticated candidate session ──
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["candidate"]);
    if (roleError) return roleError;

    // Use session email as source of truth
    const email = user.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Invalid session email" }, { status: 400 });
    }

    const body = await req.json();
    const { phone, aadhaarNumber, dob, gender } = body;

    const { db } = await connectToDatabase();

    // Check if candidate verification is complete and has expired (24 hours after completion)
    const verification = await db.collection("verifications").findOne({ email });
    if (verification && verification.status === "Completed" && verification.completedAt) {
      const completedTime = new Date(verification.completedAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - completedTime > twentyFourHours) {
        return NextResponse.json({ error: "Your access has expired. Candidate login is deactivated 24 hours after verification completion." }, { status: 403 });
      }
    }
    
    // Encrypt sensitive PII fields
    const encryptedAadhaar = aadhaarNumber ? encrypt(aadhaarNumber) : null;
    const encryptedDob = dob ? encrypt(dob) : null;
    const maskedAadhaar = aadhaarNumber ? maskAadhaar(aadhaarNumber) : null;

    // Only update the candidate's own record (matched by session email)
    const result = await db.collection("verifications").updateOne(
      { email },
      {
        $set: {
          phone,
          aadhaarNumber: encryptedAadhaar,
          aadhaarNumberMasked: maskedAadhaar,
          dob: encryptedDob,
          gender,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DATA] Candidate POST error:", error.message);
    return NextResponse.json({ error: "Failed to save details" }, { status: 500 });
  }
}
