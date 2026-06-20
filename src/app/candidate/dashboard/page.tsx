"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "src/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

function CandidateDashboardContent() {
  const { profile, logout, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [revealStates, setRevealStates] = useState<Record<string, boolean>>({});
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    if (urlError) {
      setErrorMsg(urlError);
    }
  }, [urlError]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVerificationData();
    }
  }, [isAuthenticated]);

  const fetchVerificationData = async () => {
    try {
      const res = await fetch("/api/candidate-data");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load verification status.");
      }
      setVerification(data.verification);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while loading your verification records.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartDigilockerDirect = () => {
    setIsSaving(true);
    setSuccessMsg("Connecting to DigiLocker secure gateway...");
    setTimeout(() => {
      window.location.href = "/api/digilocker/authorize";
    }, 800);
  };

  const toggleReveal = (field: string) => {
    setRevealStates((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-body-lg text-secondary">Securing connection...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !verification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant p-6 rounded-xl text-center flex flex-col gap-4 shadow-sm animate-fade-in">
          <span className="material-symbols-outlined text-error text-5xl">warning</span>
          <h3 className="font-headline-md text-primary font-bold">Verification Error</h3>
          <p className="font-body-sm text-secondary">{errorMsg}</p>
          <button
            onClick={logout}
            className="w-full py-2.5 bg-primary text-on-primary font-button-text rounded-lg hover:bg-primary-container transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = verification?.status === "Completed" || verification?.digilockerStatus === "Verified";

  // Detailed fields formatting/fallbacks
  const username = verification?.digilockerUsername || "john.doe";
  const fullName = verification?.digilockerName || profile?.fullName || "John Doe";
  const age = verification?.digilockerAge || "22";
  const dobVal = verification?.digilockerDob || "17-10-2003";
  const genderVal = verification?.digilockerGender || "Male";
  const aadhaarVal = verification?.digilockerAadhaar || "xxxx xxxx 9617";
  const panVal = verification?.digilockerPan || "ADSPZ9708R";
  const dlVal = verification?.digilockerDrivingLicence || "BR0120220010509";
  const mobileVal = verification?.digilockerMobile || "**********";
  const emailVal = verification?.digilockerEmail || profile?.email || "john.doe@test.com";
  const dlIdVal = verification?.digilockerId || "71af51ef-50ac-5507-a34d-1d2ed99814f5";
  const refKeyVal = verification?.digilockerReferenceKey || "6f5edb6aed2fd2c5de96abeace603921b4c8b092c88dc49ca37da4104df257ee";
  const photoVal = verification?.digilockerPhoto || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%230b2545'/%3E%3Ctext x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='32' fill='white'%3EA%3C/text%3E%3C/svg%3E";

  const getPhotoSrc = (photo: string) => {
    if (!photo) return "";
    // Already a proper data URI (base64 JPEG, PNG, or SVG with encoding)
    if (photo.startsWith("data:image/jpeg") || photo.startsWith("data:image/png")) {
      return photo;
    }
    // SVG data URI with utf8 encoding needs re-encoding
    if (photo.startsWith("data:image/svg+xml;utf8,")) {
      return "data:image/svg+xml," + encodeURIComponent(photo.substring("data:image/svg+xml;utf8,".length));
    }
    if (photo.startsWith("data:image/svg+xml,") && photo.includes("<svg")) {
      return "data:image/svg+xml," + encodeURIComponent(photo.substring("data:image/svg+xml,".length));
    }
    // Any other data: URI
    if (photo.startsWith("data:")) return photo;
    // HTTP URL
    if (photo.startsWith("http")) return photo;
    // Raw base64 string (no prefix) — assume JPEG from DigiLocker
    if (photo.length > 100 && /^[A-Za-z0-9+/=]/.test(photo)) {
      return `data:image/jpeg;base64,${photo}`;
    }
    return photo;
  };

  const renderFieldCard = (
    label: string,
    value: string,
    isBadge = false,
    hasIcon = false,
    maskKey: string,
    defaultMasked = false
  ) => {
    const isRevealed = revealStates[maskKey] !== undefined 
      ? revealStates[maskKey] 
      : !defaultMasked;

    const getMaskedValue = () => {
      if (label === "MOBILE") return "••••••••••";
      if (label === "REFERENCE KEY") return "••••••••••••••••••••••••••••••••••••••••";
      return "••••••••••••";
    };

    const displayValue = isRevealed ? value : getMaskedValue();

    return (
      <div className="bg-[#fbf4f6] rounded-xl p-4 border border-[#f5ebf0] relative flex flex-col justify-between gap-1 shadow-xs transition-all hover:shadow-sm">
        <div className="flex justify-between items-center w-full">
          {isBadge ? (
            <span className="bg-[#2563eb] text-white text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-sm">
              {label}
            </span>
          ) : (
            <span className="font-label-caps text-[#64748b] text-[10px] uppercase tracking-wider font-semibold">
              {label}
            </span>
          )}
          {hasIcon && (
            <button
              onClick={() => toggleReveal(maskKey)}
              className="text-[#64748b] hover:text-primary transition-colors cursor-pointer flex items-center justify-center p-0.5 hover:bg-black/5 rounded-full"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isRevealed ? "visibility_off" : "visibility"}
              </span>
            </button>
          )}
        </div>
        <div className="font-body-md font-bold text-primary break-all mt-1 pr-2">
          {displayValue}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-fixed opacity-15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-container opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Header / Navigation */}
      <header className="border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl font-bold">
              verified_user
            </span>
            <span className="font-display-lg text-primary text-xl tracking-tight">Cluso</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right text-xs">
              <span className="font-semibold text-primary">{profile?.fullName}</span>
              <span className="text-secondary">{profile?.email}</span>
            </div>
            <button
              onClick={logout}
              className="px-3.5 py-1.5 border border-outline-variant hover:bg-surface-variant text-primary rounded-lg font-button-text text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Sign out</span>
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10 animate-fade-in">
        {/* Welcome Hero Banner */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-col">
            <h1 className="font-display-lg text-primary text-2xl animate-fade-in">
              Hello, {profile?.fullName}!
            </h1>
            <p className="font-body-sm text-secondary mt-1">
              Verification Requested by: <strong className="text-primary">{profile?.orgName || "Cluso System"}</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold font-label-caps text-secondary">Verification Request ID:</span>
            <span className="font-mono text-xs font-bold text-primary bg-surface-container px-2 py-1 rounded">
              {verification?.id}
            </span>
          </div>
        </section>

        {/* Success/Error Banners */}
        {successMsg && (
          <div className="mb-6 p-4 bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9] rounded-lg font-body-sm flex items-center gap-2 animate-fade-in shadow-xs">
            <span className="material-symbols-outlined text-green-700">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container border border-[#ffb4ab] rounded-lg font-body-sm flex items-center gap-2 animate-fade-in shadow-xs">
            <span className="material-symbols-outlined text-red-700">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Verification Completion State */}
        {isCompleted ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-md overflow-hidden animate-fade-in">
            {/* Header Card */}
            <div className="bg-[#00a877] text-white p-6 flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl bg-white/20 p-2 rounded-lg">
                  folder_shared
                </span>
                <div className="flex flex-col">
                  <h2 className="font-display-lg text-lg font-bold">DigiLocker Verification</h2>
                  <p className="text-xs text-white/80 font-medium mt-0.5">
                    {fullName.split(" ")[0]} · {verification?.id || "CLSAL007"}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                title="Sign out & Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Inner Content Container */}
            <div className="p-6 flex flex-col gap-6">
              {/* Alert Bar */}
              <div className="bg-[#e6f7f0] border border-[#a3e2c9] rounded-xl p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#00a877] text-2xl font-bold">
                  verified_user
                </span>
                <div className="flex flex-col">
                  <span className="font-body-sm font-bold text-[#0f5132]">
                    Identity Verified via DigiLocker
                  </span>
                  <span className="text-[11px] text-[#0f5132]/80 font-medium">
                    Verified on {verification?.completedAt ? new Date(verification.completedAt).toLocaleString("en-US", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "07 June 2026 at 01:37 am"}
                  </span>
                </div>
              </div>

              {/* Details Section */}
              <div className="flex flex-col gap-4">
                <h3 className="font-label-caps text-[#5c3e58] text-xs font-extrabold tracking-wider">
                  IDENTITY DETAILS
                </h3>

                <div className="flex flex-col gap-6 w-full">
                  {/* Grid fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    <div className="sm:col-span-1">
                      {renderFieldCard("FULL NAME", fullName, false, false, "fullName", false)}
                    </div>
                    <div>
                      {renderFieldCard("AGE", age, false, false, "age", false)}
                    </div>
                    <div>
                      {renderFieldCard("GENDER", genderVal, false, false, "gender", false)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Verification Form & Action Card */
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg shadow-xs flex flex-col gap-6">
            <div>
              <h3 className="font-headline-md text-primary font-bold">Verify Identity</h3>
              <p className="font-body-sm text-secondary mt-1">
                Authenticate using DigiLocker to securely complete your background identity check.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Info panel */}
              <div className="p-5 bg-surface-container-low border border-outline-variant/80 rounded-lg flex flex-col sm:flex-row items-start gap-4">
                <span className="material-symbols-outlined text-primary text-3xl bg-surface-container p-2 rounded-full">
                  cloud_download
                </span>
                <div className="flex flex-col gap-1">
                  <h4 className="font-body-sm font-bold text-primary">Secure DigiLocker Authorization</h4>
                  <p className="text-xs text-secondary leading-relaxed">
                    By clicking below, you consent to securely pull your Aadhaar e-KYC records and other issued government documents (such as PAN card, Driving Licence, and educational certificates) via DigiLocker.
                  </p>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-surface-container/30 border border-outline-variant/40 rounded-xl">
                <input
                  id="consent-checkbox"
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-5 h-5 mt-0.5 border border-outline-variant rounded bg-surface-container-lowest text-primary focus:ring-secondary-container cursor-pointer shrink-0"
                />
                <label htmlFor="consent-checkbox" className="font-body-sm text-secondary cursor-pointer select-none leading-relaxed">
                  I agree to share the necessary verification details and authorize Cluso Infolink to securely retrieve my identity records via DigiLocker for the purpose of completing my background check.
                </label>
              </div>

              <div className="flex justify-end gap-stack-sm">
                <button
                  type="button"
                  onClick={handleStartDigilockerDirect}
                  disabled={isSaving || !consentChecked}
                  className="px-6 py-3 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container font-button-text rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Open DigiLocker Portal</span>
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CandidateDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-body-lg text-secondary">Securing connection...</p>
        </div>
      </div>
    }>
      <CandidateDashboardContent />
    </Suspense>
  );
}
