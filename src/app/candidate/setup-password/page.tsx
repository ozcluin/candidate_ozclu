"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  useEffect(() => {
    router.replace("/");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrong || !passwordsMatch) return;

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus("success");
      } else {
        setMessage(data.error || "Failed to set password.");
        setStatus("error");
      }
    } catch {
      setMessage("Network error. Please try again.");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading state ───
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-10 h-10 border-3 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Verifying your setup link...</p>
        </div>
      </div>
    );
  }

  // ─── Invalid / expired token ───
  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-500 text-3xl">link_off</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Setup Link Invalid</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">{message}</p>
          <p className="text-xs text-slate-400">
            Please contact your organisation administrator for a new setup link.
          </p>
        </div>
      </div>
    );
  }

  // ─── Success state ───
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Password Set Successfully!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Your account is now active. You can log in to the candidate portal with your email and new password.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ─── Set password form (valid token or error retry) ───
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-blue-600 text-2xl">lock</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Set Your Password</h2>
          <p className="text-slate-500 text-sm mt-1">
            Create a secure password for <strong className="text-slate-700">{email}</strong>
          </p>
        </div>

        {message && status === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              autoComplete="new-password"
            />
          </div>

          {/* Password strength indicators */}
          <div className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Password Requirements
            </span>
            {[
              { met: hasMinLength, label: "At least 8 characters" },
              { met: hasUppercase, label: "One uppercase letter" },
              { met: hasLowercase, label: "One lowercase letter" },
              { met: hasNumber, label: "One number" },
              { met: passwordsMatch, label: "Passwords match" },
            ].map((req) => (
              <div key={req.label} className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-sm ${
                    req.met ? "text-emerald-500" : "text-slate-300"
                  }`}
                >
                  {req.met ? "check_circle" : "radio_button_unchecked"}
                </span>
                <span
                  className={`text-xs ${
                    req.met ? "text-emerald-700 font-medium" : "text-slate-400"
                  }`}
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!isStrong || !passwordsMatch || submitting}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Setting Password...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">lock</span>
                Set Password & Activate Account
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="w-10 h-10 border-3 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      }
    >
      <SetupPasswordForm />
    </Suspense>
  );
}
