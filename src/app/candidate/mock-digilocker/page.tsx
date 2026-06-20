"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function MockDigilockerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const state = searchParams.get("state") || "";
  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";

  // State controls
  const [step, setStep] = useState(1); // 1: Aadhaar Number, 2: OTP Entry, 3: Consent/Select Profile
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState("john_doe");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaar.replace(/\s/g, "").length !== 12) {
      setErrorMsg("Please enter a valid 12-digit Aadhaar number.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1000);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setErrorMsg("Please enter a 6-digit OTP code.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 1000);
  };

  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setErrorMsg("You must check the consent box to share e-KYC details.");
      return;
    }
    setErrorMsg("");
    setLoading(true);

    setTimeout(() => {
      // Build callback URL redirecting to /api/digilocker/callback
      // Append mock code, state, and selected profile details
      const profileCode = selectedProfile === "john_doe" ? "john_doe" : "jane_smith";
      const targetUrl = `${redirectUri}?code=mock_code_${profileCode}&state=${state}`;
      window.location.href = targetUrl;
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col font-sans">
      {/* Official Government Top Bar */}
      <div className="bg-[#0b2545] text-white py-2 px-4 text-xs font-medium flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <span className="bg-[#ff9933] w-2 h-2 rounded-full"></span>
          <span>Ministry of Electronics & IT (MeitY), Government of India</span>
        </div>
        <div>National Portal of India</div>
      </div>

      {/* DigiLocker Branded Banner Header */}
      <header className="bg-white border-b border-[#e1e5e8] py-4 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#0074d9] text-white p-2 rounded-lg font-bold flex items-center justify-center text-lg shadow-sm">
              DL
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-[#0b2545] tracking-tight">DigiLocker</span>
              <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Your documents Anytime, Anywhere</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-[#0074d9]">
            <span>English</span>
            <span className="text-gray-300">|</span>
            <span>Help</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-md relative overflow-hidden">
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#128807]"></div>

          {/* Loader Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-[#0074d9] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-gray-600 font-semibold mt-4">Processing secure request...</p>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Client Reference details */}
          <div className="mb-6 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <p className="text-gray-600 font-semibold mb-1">Authorization Request</p>
            <div className="grid grid-cols-2 gap-1 text-gray-500">
              <div>Portal Name:</div>
              <div className="font-bold text-gray-800">Cluso Verification</div>
              <div>Client ID:</div>
              <div className="font-mono">{clientId || "URA1DC8310"}</div>
            </div>
          </div>

          {/* STEP 1: Enter Aadhaar */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <h3 className="font-bold text-gray-800 text-lg">Verify via Aadhaar</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Provide your 12-digit Aadhaar number to fetch e-KYC documents.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Aadhaar Number</label>
                <input
                  type="text"
                  placeholder="e.g. 0000 0000 0000"
                  required
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="p-3 border border-gray-300 rounded-lg text-sm font-semibold tracking-widest text-center focus:outline-none focus:border-[#0074d9]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0074d9] hover:bg-[#005bb5] text-white py-3 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                <span>Send Verification OTP</span>
                <span className="material-symbols-outlined text-sm">sms</span>
              </button>
            </form>
          )}

          {/* STEP 2: Enter OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <h3 className="font-bold text-gray-800 text-lg">Enter Aadhaar OTP</h3>
                <p className="text-xs text-gray-500 mt-1">
                  A temporary verification code has been dispatched to your mobile.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">One-Time Password (OTP)</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="p-3 border border-gray-300 rounded-lg text-sm font-semibold tracking-widest text-center focus:outline-none focus:border-[#0074d9]"
                />
                <span className="text-[10px] text-gray-400 mt-1 italic text-center">
                  (You can enter any 6 digits to bypass in simulation mode)
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0074d9] hover:bg-[#005bb5] text-white py-3 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                <span>Verify OTP & Proceed</span>
                <span className="material-symbols-outlined text-sm">vpn_key</span>
              </button>
            </form>
          )}

          {/* STEP 3: Consent & Profile Selection */}
          {step === 3 && (
            <form onSubmit={handleAuthorize} className="flex flex-col gap-5">
              <div className="text-center mb-2">
                <h3 className="font-bold text-[#128807] text-lg flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-xl">verified</span>
                  <span>Aadhaar Authenticated</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Select a mock profile to share for verification testing.
                </p>
              </div>

              <div className="flex flex-col gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select e-KYC Identity Mock</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProfile("john_doe")}
                    className={`flex-1 py-2 rounded font-semibold text-xs border transition-colors ${
                      selectedProfile === "john_doe"
                        ? "bg-[#0074d9]/10 border-[#0074d9] text-[#0074d9]"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    John (Male, john_doe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProfile("jane_smith")}
                    className={`flex-1 py-2 rounded font-semibold text-xs border transition-colors ${
                      selectedProfile === "jane_smith"
                        ? "bg-[#0074d9]/10 border-[#0074d9] text-[#0074d9]"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Jane (Female, jane_smith)
                  </button>
                </div>
              </div>

              {/* Consent Box */}
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 border-gray-300 rounded text-[#0074d9] focus:ring-[#0074d9] cursor-pointer"
                />
                <label htmlFor="consent" className="text-[11px] text-gray-500 leading-relaxed cursor-pointer select-none">
                  I hereby provide my consent to DigiLocker to share my Aadhaar e-KYC profile, name, date of birth, and gender with **Cluso Verification Portal** for background check purposes.
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-[#128807] hover:bg-[#0d6b05] text-white py-3 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                <span>Authorize & Share</span>
                <span className="material-symbols-outlined text-sm">share</span>
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Official Government Footer */}
      <footer className="bg-[#0b2545] text-gray-400 py-6 text-center text-xs border-t border-[#e2e8f0]/10 mt-auto">
        <p>© 2026 DigiLocker, National Division of e-Governance (NeGD), Government of India.</p>
        <p className="mt-1.5 opacity-60">This is a Secure Simulation Environment for Developer Sandbox API testing.</p>
      </footer>
    </div>
  );
}

export default function MockDigilockerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f7f6] flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-[#0074d9] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-600 font-semibold mt-4 animate-pulse">Connecting to DigiLocker secure gateway...</p>
      </div>
    }>
      <MockDigilockerPageContent />
    </Suspense>
  );
}
