import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireRole,
  isErrorResponse,
} from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { cookies } from "next/headers";
import { encrypt, maskAadhaar, maskPan, maskDl } from "shared/encryption";
import { getClientIp, getUserAgent, logAuditEvent } from "shared/audit";
import { checkRateLimit, RATE_LIMITS } from "shared/rateLimit";

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
      return NextResponse.json({ error: "No email associated with session" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    // Rate Limit: 10 per hour per email
    const rateLimitKey = `digilocker_callback:${ip}:${email}`;
    const limitCheck = await checkRateLimit(db, rateLimitKey, RATE_LIMITS.DIGILOCKER_CALLBACK.maxAttempts, RATE_LIMITS.DIGILOCKER_CALLBACK.windowMs);
    if (!limitCheck.allowed) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: email,
        actorRole: user.role,
        portal: "candidate",
        action: "rate_limit_hit",
        outcome: "failure",
        reason: "DigiLocker callback rate limit exceeded",
        ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "Too many DigiLocker attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((limitCheck.retryAfterMs || 0) / 1000).toString(),
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);

    // Handle error responses from DigiLocker (e.g., invalid_scope, access_denied, user_cancelled)
    const oauthError = searchParams.get("error");
    if (oauthError) {
      const errorDescription = searchParams.get("error_description") || oauthError;
      console.error(`[DigiLocker] OAuth error: ${oauthError} - ${errorDescription}`);
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: email,
        actorRole: user.role,
        portal: "candidate",
        action: "digilocker_oauth_error",
        outcome: "failure",
        reason: `DigiLocker returned error: ${oauthError} - ${errorDescription}`,
        ip,
        userAgent,
      });
      return NextResponse.redirect(
        new URL(`/candidate/dashboard?error=${encodeURIComponent(`DigiLocker verification failed: ${errorDescription}`)}`, req.url)
      );
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.json({ error: "Authorization code not provided" }, { status: 400 });
    }

    let digilockerUsername = "";
    let digilockerName = "";
    let digilockerAge = "";
    let dob = "";
    let gender = "";
    let digilockerAadhaar = "";
    let digilockerPan = "";
    let digilockerDrivingLicence = "";
    let digilockerMobile = "";
    let digilockerEmail = "";
    let digilockerId = "";
    let digilockerReferenceKey = "";
    let digilockerPhoto = "";
    let digilockerEaadhaar = "";

    let digilockerDocuments: any[] = [];
    const isMock = code.startsWith("mock_code_");

    // SECURITY: Hard-block mock codes in production
    if (isMock && process.env.NODE_ENV === "production") {
      console.error(`[DigiLocker] Rejected mock code in production for user: ${email}`);
      return NextResponse.json({ error: "Mock DigiLocker codes are not accepted in production." }, { status: 403 });
    }

    if (isMock) {
      // Decode mock profiles
      if (code.includes("john_doe")) {
        digilockerUsername = "john.doe";
        digilockerName = "John Doe";
        digilockerAge = "22";
        dob = "17-10-2003";
        gender = "Male";
        digilockerAadhaar = "xxxxxxxx9617";
        digilockerPan = "ADSPZ9708R";
        digilockerDrivingLicence = "BR0120220010509";
        digilockerMobile = "**********";
        digilockerEmail = "john.doe@test.com";
        digilockerId = "71af51ef-50ac-5507-a34d-1d2ed99814f5";
        digilockerReferenceKey = "6f5edb6aed2fd2c5de96abeace603921b4c8b092c88dc49ca37da4104df257ee";
        digilockerPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230b2545'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='32' fill='white'>J</text></svg>";
        
        digilockerDocuments = [
          {
            id: "doc_aadhaar",
            name: "Aadhaar Card",
            type: "ADHAR",
            uri: "in.gov.uidai-ADHAR-XXXX-XXXX-9617",
            issuer: "Unique Identification Authority of India (UIDAI)",
            issueDate: "15-08-2016",
            status: "VERIFIED"
          },
          {
            id: "doc_pan",
            name: "PAN Verification Record",
            type: "PANCR",
            uri: "in.gov.income_tax-PANCR-ADSPZ9708R",
            issuer: "Income Tax Department",
            issueDate: "10-09-2018",
            status: "VERIFIED"
          },
          {
            id: "doc_dl",
            name: "Driving Licence",
            type: "DRVLC",
            uri: "in.gov.transport-DRVLC-BR0120220010509",
            issuer: "Ministry of Road Transport and Highways",
            issueDate: "12-04-2022",
            status: "VERIFIED"
          }
        ];
      } else {
        digilockerUsername = "jane.smith";
        digilockerName = "Jane Smith";
        digilockerAge = "24";
        dob = "05-06-2002";
        gender = "Female";
        digilockerAadhaar = "xxxxxxxx9210";
        digilockerPan = "BPSPK1104K";
        digilockerDrivingLicence = "DL0120240059871";
        digilockerMobile = "**********";
        digilockerEmail = "jane.smith@test.com";
        digilockerId = "DL-BROTHER-1994";
        digilockerReferenceKey = "1a2b3c4d5e6f7g8h9i0j9a8b7c6d5e4f3g2h1i0j9a8b7c6d5e4f3g2h1i0j9a8b";
        digilockerPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f43f5e'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='32' fill='white'>J</text></svg>";
        
        digilockerDocuments = [
          {
            id: "doc_aadhaar_jane",
            name: "Aadhaar Card",
            type: "ADHAR",
            uri: "in.gov.uidai-ADHAR-XXXX-XXXX-9210",
            issuer: "Unique Identification Authority of India (UIDAI)",
            issueDate: "20-11-2017",
            status: "VERIFIED"
          },
          {
            id: "doc_cbse_12",
            name: "Class XII Marksheet",
            type: "HSCER",
            uri: "in.gov.cbse-HSCER-2020-883719",
            issuer: "Central Board of Secondary Education",
            issueDate: "13-07-2020",
            status: "VERIFIED"
          }
        ];
      }
    } else {
      // Real DigiLocker API Exchange with PKCE
      const cookieStore = await cookies();
      const codeVerifier = cookieStore.get("code_verifier")?.value || "";

      const baseUrl = "https://digilocker.meripehchaan.gov.in/public";
      
      console.log("Exchanging real authorization code with PKCE...");
      const tokenRes = await fetch(`${baseUrl}/oauth2/2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: process.env.DIGILOCKER_CLIENT_ID || "",
          client_secret: process.env.DIGILOCKER_CLIENT_SECRET || "",
          redirect_uri: process.env.DIGILOCKER_CALLBACK_URL || "",
          code_verifier: codeVerifier,
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData.error_description || "DigiLocker token exchange failed");
      }

      // Log token exchange success without exposing token values
      console.log(`[DigiLocker] Token exchange successful for user: ${email}`);

      // Clear cookies
      cookieStore.delete("code_verifier");
      cookieStore.delete("nonce");

      // Helper: parse DOB from various DigiLocker formats into "DD-MM-YYYY"
      const parseDob = (raw: string): string => {
        if (!raw) return "";
        // Format: "DD/MM/YYYY" (from JWT birthdate)
        if (raw.includes("/")) return raw.replace(/\//g, "-");
        // Format: "DDMMYYYY" (from top-level dob, 8 digits no delimiters)
        if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4)}`;
        // Format: "DD-MM-YYYY" already
        if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw;
        return raw;
      };

      // Helper: compute age from "DD-MM-YYYY" string
      const computeAge = (dobStr: string): string => {
        if (!dobStr) return "N/A";
        const parts = dobStr.split("-");
        if (parts.length !== 3) return "N/A";
        const [dd, mm, yyyy] = parts;
        const birthDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
        if (isNaN(birthDate.getTime())) return "N/A";
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return String(age);
      };

      let user: any = {};
      let jwtClaims: any = {};

      // 1. Decode id_token JWT claims if present
      // The JWT contains rich data: given_name, birthdate, gender, email, phone_number,
      // pan_number, driving_licence, masked_aadhaar, preferred_username, digilockerid, reference_key
      const idToken = tokenData.id_token || tokenData.fullTokenResponse?.id_token;
      if (idToken) {
        try {
          const parts = idToken.split('.');
          if (parts.length === 3) {
            jwtClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            console.log("Decoded JWT claims:", JSON.stringify(jwtClaims));
            user = {
              ...user,
              name: jwtClaims.given_name || jwtClaims.name || jwtClaims.preferred_username,
              dob: jwtClaims.birthdate || jwtClaims.dob,
              gender: jwtClaims.gender,
              email: jwtClaims.email,
              mobile: jwtClaims.phone_number || jwtClaims.mobile,
              masked_aadhaar: jwtClaims.masked_aadhaar,
              pan_number: jwtClaims.pan_number,
              driving_licence: jwtClaims.driving_licence,
              digilockerid: jwtClaims.digilockerid || jwtClaims.sub,
              preferred_username: jwtClaims.preferred_username,
              reference_key: jwtClaims.reference_key,
            };
          }
        } catch (jwtErr: any) {
          console.warn("Could not decode id_token:", jwtErr.message);
        }
      }

      // 2. Merge top-level tokenData response fields (these override JWT where present)
      // The real API returns name, dob, gender, email, mobile, digilockerid, reference_key
      // at the top level of the token response as well
      if (tokenData.digilockerid) user.digilockerid = tokenData.digilockerid;
      if (tokenData.name) user.name = tokenData.name;
      if (tokenData.dob) user.dob = tokenData.dob;
      if (tokenData.gender) user.gender = tokenData.gender;
      if (tokenData.mobile) user.mobile = tokenData.mobile;
      if (tokenData.email) user.email = tokenData.email;
      if (tokenData.reference_key) user.reference_key = tokenData.reference_key;
      if (tokenData.eaadhaar) {
        user.eaadhaar = tokenData.eaadhaar;
        digilockerEaadhaar = tokenData.eaadhaar;
      }

      // 2b. Also merge _idTokenClaims if present at top level (some response shapes include this)
      const idClaims = tokenData._idTokenClaims;
      if (idClaims) {
        if (idClaims.masked_aadhaar) user.masked_aadhaar = idClaims.masked_aadhaar;
        if (idClaims.pan_number) user.pan_number = idClaims.pan_number;
        if (idClaims.driving_licence) user.driving_licence = idClaims.driving_licence;
        if (idClaims.preferred_username) user.preferred_username = idClaims.preferred_username;
        if (idClaims.given_name && !user.name) user.name = idClaims.given_name;
        if (idClaims.birthdate && !user.dob) user.dob = idClaims.birthdate;
        if (idClaims.phone_number && !user.mobile) user.mobile = idClaims.phone_number;
        if (idClaims.email && !user.email) user.email = idClaims.email;
        if (idClaims.gender && !user.gender) user.gender = idClaims.gender;
        if (idClaims.reference_key && !user.reference_key) user.reference_key = idClaims.reference_key;
        if (idClaims.digilockerid && !user.digilockerid) user.digilockerid = idClaims.digilockerid;
      }

      // 3. Try to call `/user` API for any additional details
      const accessToken = tokenData.access_token || tokenData.fullTokenResponse?.access_token;
      if (accessToken) {
        try {
          const userRes = await fetch(`${baseUrl}/oauth2/1/user`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (userRes.ok) {
            const apiUser = await userRes.json();
            console.log("User API response merged:", JSON.stringify(apiUser));
            // Only overlay fields that aren't already populated
            for (const [key, val] of Object.entries(apiUser)) {
              if (val && !user[key]) user[key] = val;
            }
          }
        } catch (userErr: any) {
          console.warn("User API details fetch failed:", userErr.message);
        }
      }

      // Ensure basic username and ID fields are populated
      if (!user.digilockerid) {
        user.digilockerid = tokenData.sub || accessToken?.substring(0, 16) || "unknown";
      }

      // --- Map extracted data to our standard fields ---
      digilockerName = user.name || "DigiLocker User";
      digilockerUsername = user.preferred_username || user.digilockerid || "dl_user";
      
      // Parse DOB - handle "17102003", "17/10/2003", or "17-10-2003"
      dob = parseDob(user.dob || "");
      
      gender = user.gender === "M" || user.gender === "Male" ? "Male" : user.gender === "F" || user.gender === "Female" ? "Female" : user.gender || "Other";
      
      // Aadhaar: use masked_aadhaar field (e.g. "xxxxxxxx9617")
      if (user.masked_aadhaar) {
        digilockerAadhaar = user.masked_aadhaar;
      } else {
        digilockerAadhaar = "N/A";
      }
      
      // PAN: directly from JWT claims pan_number field
      digilockerPan = user.pan_number || "";
      
      // Driving Licence: directly from JWT claims driving_licence field
      digilockerDrivingLicence = user.driving_licence || "";
      
      digilockerMobile = user.mobile || "**********";
      digilockerEmail = user.email || email;
      digilockerId = user.digilockerid || "N/A";
      digilockerReferenceKey = user.reference_key || "N/A";
      digilockerAge = computeAge(dob);

      // Photo: handle base64 JPEG from picture field, or SVG fallback
      const rawPicture = tokenData.picture || user.photo || user.picture;
      if (rawPicture) {
        // If it's already a data URI, use as-is
        if (rawPicture.startsWith("data:")) {
          digilockerPhoto = rawPicture;
        } else if (rawPicture.startsWith("http")) {
          digilockerPhoto = rawPicture;
        } else {
          // Assume base64 JPEG string from DigiLocker API
          digilockerPhoto = `data:image/jpeg;base64,${rawPicture}`;
        }
      } else {
        const initial = digilockerName.charAt(0).toUpperCase();
        digilockerPhoto = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230b2545'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='32' fill='white'>${initial}</text></svg>`;
      }

      // 4. Fetch documents from v2 and v1 endpoints
      let documentsData: any = null;
      
      // First check if documents came embedded in the token response itself
      if (tokenData.documents && Array.isArray(tokenData.documents.items)) {
        documentsData = tokenData.documents;
        console.log(`Token response included ${documentsData.items.length} embedded documents`);
      }

      // Also try API endpoints for issued documents (may return more)
      if (accessToken) {
        try {
          const docsResV2 = await fetch(`${baseUrl}/oauth2/2/files/issued`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (docsResV2.ok) {
            const v2Docs = await docsResV2.json();
            console.log(`v2 returned ${v2Docs?.items?.length || 0} issued documents`);
            if ((v2Docs?.items?.length || 0) > (documentsData?.items?.length || 0)) {
              documentsData = v2Docs;
            }
          }
        } catch (docErr: any) {
          console.warn("v2 files/issued endpoint failed:", docErr.message);
        }

        try {
          const docsResV1 = await fetch(`${baseUrl}/oauth2/1/files/issued`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (docsResV1.ok) {
            const v1Docs = await docsResV1.json();
            console.log(`v1 returned ${v1Docs?.items?.length || 0} issued documents`);
            if ((v1Docs?.items?.length || 0) > (documentsData?.items?.length || 0)) {
              documentsData = v1Docs;
              console.log("Using v1 result (more documents found)");
            }
          }
        } catch (docErr: any) {
          console.warn("v1 files/issued endpoint failed:", docErr.message);
        }
      }

      // Map documents from the items array
      if (documentsData && Array.isArray(documentsData.items)) {
        digilockerDocuments = documentsData.items.map((item: any, idx: number) => ({
          id: `doc_${item.doctype || idx}_${idx}`,
          name: item.name || item.description || item.doctype || "Document",
          type: item.doctype || "",
          uri: item.uri || "",
          issuer: item.issuer || "Unknown Issuer",
          issueDate: item.date || new Date().toLocaleDateString(),
          status: "VERIFIED"
        }));
      }

      // 5. Also extract PAN & Driving Licence from document URIs (as backup if JWT didn't have them)
      for (const doc of digilockerDocuments) {
        const type = String(doc.type).toUpperCase();
        const uri = String(doc.uri);
        
        if (!digilockerPan && (type === "PANCR" || uri.includes("-PANCR-"))) {
          const parts = uri.split("-PANCR-");
          if (parts.length > 1) {
            digilockerPan = parts[1];
          } else {
            const lastPart = uri.substring(uri.lastIndexOf("-") + 1);
            if (lastPart) digilockerPan = lastPart;
          }
        }
        
        if (!digilockerDrivingLicence && (type === "DRVLC" || uri.includes("-DRVLC-"))) {
          const parts = uri.split("-DRVLC-");
          if (parts.length > 1) {
            digilockerDrivingLicence = parts[1];
          } else {
            const lastPart = uri.substring(uri.lastIndexOf("-") + 1);
            if (lastPart) digilockerDrivingLicence = lastPart;
          }
        }
      }

      // Ensure Aadhaar Card shows up in the documents list if we have masked_aadhaar but it's not in items
      const hasAadhaarInDocs = digilockerDocuments.some(doc => doc.type === "ADHAR");
      if (!hasAadhaarInDocs && user.masked_aadhaar) {
        const lastFour = user.masked_aadhaar.replace(/[^0-9]/g, "").slice(-4);
        digilockerDocuments.unshift({
          id: "doc_adhar_token",
          name: "Aadhaar Card",
          type: "ADHAR",
          uri: `in.gov.uidai-ADHAR-XXXX-XXXX-${lastFour}`,
          issuer: "Unique Identification Authority of India (UIDAI)",
          issueDate: new Date().toLocaleDateString(),
          status: user.eaadhaar === "Y" ? "VERIFIED" : "VERIFIED"
        });
      }
    }

    // Fetch original verification record to keep some fields
    const verification = await db.collection("verifications").findOne({ email });

    // Generate masked versions for safe display
    const maskedAadhaar = maskAadhaar(digilockerAadhaar);
    const maskedPan = maskPan(digilockerPan);
    const maskedDl = maskDl(digilockerDrivingLicence);

    // Encrypt sensitive PII fields
    const encryptedAadhaar = digilockerAadhaar ? encrypt(digilockerAadhaar) : null;
    const encryptedPan = digilockerPan ? encrypt(digilockerPan) : null;
    const encryptedDl = digilockerDrivingLicence ? encrypt(digilockerDrivingLicence) : null;
    const encryptedDob = dob ? encrypt(dob) : null;
    const encryptedId = digilockerId ? encrypt(digilockerId) : null;
    const encryptedRefKey = digilockerReferenceKey ? encrypt(digilockerReferenceKey) : null;

    const docListText = digilockerDocuments.map((doc, idx) => `${idx + 1}. ${doc.name} (${doc.issuer}) - ${doc.status}\n   URI: ${doc.uri}`).join("\n");

    const reportDetails = `e-KYC verification completed successfully via DigiLocker.

Verified Profile:
- Full Name: ${digilockerName}
- Username: ${digilockerUsername}
- Age: ${digilockerAge}
- Date of Birth: ${dob ? "Matched & Secured" : "N/A"}
- Gender: ${gender}
- Aadhaar Number Reference: ${maskedAadhaar}
- PAN Verification Reference: ${maskedPan || "N/A"}
- Driving Licence Reference: ${maskedDl || "N/A"}
- Mobile Reference: ${digilockerMobile}
- Email Reference: ${digilockerEmail}
- DigiLocker ID: [Secured]
- Reference Key: [Secured]

Verified Documents Retrieved:
${docListText}`;

    const completionAttempt = {
      date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase(),
      verifier: verification?.verifier || "System Auto-Verify",
      status: "Completed",
      notes: "Identity verified via DigiLocker e-KYC integration."
    };

    await db.collection("verifications").updateOne(
      { email },
      {
        $set: {
          digilockerStatus: "Verified",
          status: "Completed",
          digilockerUsername,
          digilockerName,
          digilockerAge,
          digilockerDob: encryptedDob,
          digilockerGender: gender,
          digilockerAadhaar: encryptedAadhaar,
          digilockerPan: encryptedPan,
          digilockerDrivingLicence: encryptedDl,
          digilockerAadhaarMasked: maskedAadhaar,
          digilockerPanMasked: maskedPan,
          digilockerDrivingLicenceMasked: maskedDl,
          digilockerMobile,
          digilockerEmail,
          digilockerId: encryptedId,
          digilockerReferenceKey: encryptedRefKey,
          digilockerPhoto,
          digilockerDocuments,
          digilockerEaadhaar: digilockerEaadhaar || undefined,
          reportDetails,
          notes: "Verification finalized via DigiLocker e-KYC integration.",
          completedAt: new Date()
        },
        $push: {
          attempts: completionAttempt
        } as any
      },
      { upsert: true }
    );

    // Redirect back to candidate dashboard which will display the verification completed screen
    return NextResponse.redirect(new URL("/candidate/dashboard", req.url));

  } catch (error: any) {
    console.error("DigiLocker callback error:", error);
    // Redirect to dashboard with error query param to display nice error banner
    return NextResponse.redirect(new URL(`/candidate/dashboard?error=${encodeURIComponent(error.message || "Failed to process DigiLocker verification")}`, req.url));
  }
}
