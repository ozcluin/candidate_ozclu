"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "src/context/AuthContext";

export default function CandidateLoginPage() {
  const router = useRouter();
  const { login, logout, profile, isAuthenticated, isLoading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get("email")?.toLowerCase().trim();
        const currentEmail = profile?.email?.toLowerCase().trim();
        
        if (profile?.role !== "candidate" || (emailParam && currentEmail && currentEmail !== emailParam)) {
          logout();
          return;
        }
      }
      router.push("/candidate/dashboard");
    }
  }, [isAuthenticated, profile, router, logout]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const passwordParam = params.get("password");
      if (emailParam) setEmail(emailParam);
      if (passwordParam) setPassword(passwordParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSubmitting(true);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email address and temporary password.");
      setIsSubmitting(false);
      return;
    }

    try {
      await login(email, password);
      // Success triggers AuthContext listener, redirecting via useEffect
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials. Please verify your temporary password.");
      setIsSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-body-lg text-secondary">Loading secure terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-[#FFF9D0]/20 via-background to-[#CAF4FF]/30 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#CAF4FF] opacity-40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-[#FFF9D0] opacity-40 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 animate-fade-in text-center px-4">
        <div className="flex justify-center mb-6">
          <img 
            src="/cluso-infolink.png" 
            alt="Cluso Infolink Logo" 
            className="h-16 w-auto object-contain rounded-2xl shadow-2xs hover:shadow-sm transition-shadow duration-300"
          />
        </div>
        <h2 className="text-center font-display-lg text-slate-800 text-2xl mb-2">
          Candidate Portal
        </h2>
        <p className="text-center font-body-sm text-slate-500 font-medium">
          Enter your temporary credentials to begin identity verification.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 animate-fade-in px-4">
        <div className="bg-white/80 backdrop-blur-md py-8 px-4 border border-[#A0DEFF]/40 shadow-xl rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container border border-[#ffb4ab] rounded-xl font-body-sm flex items-center gap-2 shadow-2xs">
              <span className="material-symbols-outlined text-lg text-red-700">error</span>
              <span className="font-semibold text-xs">{errorMsg}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block font-label-caps text-slate-500 font-bold uppercase tracking-wider mb-2">
                Candidate Email ID
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full border border-[#A0DEFF]/40 rounded-xl p-3 font-body-sm text-slate-900 bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#5AB2FF]/40 focus:border-[#5AB2FF] transition-all placeholder-slate-400 font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block font-label-caps text-slate-500 font-bold uppercase tracking-wider mb-2">
                Temporary Password
              </label>
              <div className="mt-1 relative flex items-center">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your temporary password"
                  className="w-full border border-[#A0DEFF]/40 rounded-xl p-3 pr-10 font-body-sm text-slate-900 bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#5AB2FF]/40 focus:border-[#5AB2FF] transition-all placeholder-slate-400 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center p-1 cursor-pointer focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-xl select-none">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-primary text-slate-900 hover:bg-[#A0DEFF] font-button-text font-bold rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Secure Terminal</span>
                    <span className="material-symbols-outlined text-sm">login</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
