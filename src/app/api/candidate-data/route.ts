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
    const verifications = await db.collection("verifications")
      .find({ email }, { projection: { tempPassword: 0, password: 0 } })
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    if (!verifications || verifications.length === 0) {
      return NextResponse.json({ error: "No verification request found for this email" }, { status: 404 });
    }

    const activeVerification = verifications.find(v => v.status !== "Completed") || verifications[0];
    const hasActive = verifications.some(v => v.status !== "Completed");

    // Check if candidate verification is complete and has expired (24 hours after completion)
    // ONLY expire if there are NO active/pending verifications remaining!
    if (!hasActive && activeVerification.status === "Completed" && activeVerification.completedAt) {
      const completedTime = new Date(activeVerification.completedAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - completedTime > twentyFourHours) {
        return NextResponse.json({ error: "Your access has expired. Candidate login is deactivated 24 hours after verification completion." }, { status: 403 });
      }
    }

    const verification = activeVerification;

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
    const { db } = await connectToDatabase();

    // Check if candidate verification is complete and has expired (24 hours after completion)
    // ONLY expire if there are NO active/pending verifications remaining!
    const userVerifications = await db.collection("verifications")
      .find({ email })
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    const hasActiveVer = userVerifications.some(v => v.status !== "Completed");
    const latestVer = userVerifications[0];

    if (!hasActiveVer && latestVer && latestVer.status === "Completed" && latestVer.completedAt) {
      const completedTime = new Date(latestVer.completedAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - completedTime > twentyFourHours) {
        return NextResponse.json({ error: "Your access has expired. Candidate login is deactivated 24 hours after verification completion." }, { status: 403 });
      }
    }

    // Route based on action
    const action = body.action;

    if (action === "submitEmploymentData") {
      const { employmentData } = body;

      if (!employmentData) {
        return NextResponse.json({ error: "Employment data is required" }, { status: 400 });
      }

      // Store employment data in the verification document
      const result = await db.collection("verifications").updateOne(
        { email, type: "employment" },
        {
          $set: {
            employmentData: {
              country: employmentData.country || "",
              state: employmentData.state || "",
              city: employmentData.city || "",
              companyName: employmentData.companyName || "",
              addressLine1: employmentData.addressLine1 || "",
              addressLine2: employmentData.addressLine2 || "",
              companyTelephoneCode: employmentData.companyTelephoneCode || "+91",
              companyTelephone: employmentData.companyTelephone || "",
              department: employmentData.department || "",
              position: employmentData.position || "",
              employmentPeriodFrom: employmentData.employmentPeriodFrom || "",
              employmentPeriodTo: employmentData.employmentPeriodTo || "",
              employeeCode: employmentData.employeeCode || "",
              reportingManagerName: employmentData.reportingManagerName || "",
              reportingManagerDepartment: employmentData.reportingManagerDepartment || "",
              reportingManagerContactCode: employmentData.reportingManagerContactCode || "+91",
              reportingManagerContact: employmentData.reportingManagerContact || "",
              reportingManagerEmail: employmentData.reportingManagerEmail || "",
              annualCTC: employmentData.annualCTC || "",
              employmentType: employmentData.employmentType || "",
              agencyDetails: employmentData.agencyDetails || "",
              reasonForLeaving: employmentData.reasonForLeaving || "",
              remarks: employmentData.remarks || "",
            },
            ...(Array.isArray(employmentData.pastOrganisations) ? { pastOrganisations: employmentData.pastOrganisations } : {}),
            ...(Array.isArray(employmentData.employments) ? { employments: employmentData.employments } : {}),
            employmentDataSubmitted: true,
            employmentDataSubmittedAt: new Date().toISOString(),
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Employment verification request not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "submitEducationData") {
      const { educationData } = body;

      if (!educationData) {
        return NextResponse.json({ error: "Education data is required" }, { status: 400 });
      }

      // Store education data in the verification document
      const result = await db.collection("verifications").updateOne(
        { email, type: "education" },
        {
          $set: {
            educationData: {
              country: educationData.country || "",
              degreeType: educationData.degreeType || "",
              courseName: educationData.courseName || "",
              boardUniversity: educationData.boardUniversity || "",
              institutionName: educationData.institutionName || "",
              rollNumber: educationData.rollNumber || "",
              passingYear: educationData.passingYear || "",
              certificateFile: educationData.certificateFile || "",
              certificateFileName: educationData.certificateFileName || "",
            },
            educationDataSubmitted: true,
            educationDataSubmittedAt: new Date().toISOString(),
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Education verification request not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "submitDigitalAddressData") {
      const { payload } = body;
      const { verificationId, selfieImage, selfieGeo, houseImage, houseGeo, consentTimestamp, deviceInfo } = payload || {};

      if (!selfieImage || !houseImage || !selfieGeo || !houseGeo) {
        return NextResponse.json({ error: "Selfie, house image, and geo-location coordinates are required." }, { status: 400 });
      }

      const query = verificationId ? { id: verificationId, email } : { email, type: "digital_address" };

      const result = await db.collection("verifications").updateOne(
        query,
        {
          $set: {
            digitalAddressData: {
              selfieImage,
              selfieGeoLat: selfieGeo.lat,
              selfieGeoLng: selfieGeo.lng,
              selfieGeoAccuracy: selfieGeo.accuracy,
              selfieTimestamp: selfieGeo.timestamp,
              houseImage,
              houseGeoLat: houseGeo.lat,
              houseGeoLng: houseGeo.lng,
              houseGeoAccuracy: houseGeo.accuracy,
              houseTimestamp: houseGeo.timestamp,
              consentGiven: true,
              consentTimestamp: consentTimestamp || new Date().toISOString(),
              deviceInfo: deviceInfo || "",
            },
            digitalAddressSubmitted: true,
            digitalAddressSubmittedAt: new Date().toISOString(),
            status: "Completed",
            completedAt: new Date().toISOString(),
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Digital address verification request not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Default: existing phone/aadhaar/dob/gender handler
    const { phone, aadhaarNumber, dob, gender } = body;
    
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

