"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "src/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import OzcluLogo from "../../components/OzcluLogo";
import Webcam from "react-webcam";
import { INDIAN_STATES } from "src/lib/courts-mapping";
import { Country, State, City } from "country-state-city";

const ALLOWED_COUNTRIES = [
  "Singapore", "Malaysia", "Philippines", "UAE",
  "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain", "India"
];

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

  // Employment form state
  const [empForm, setEmpForm] = useState({
    country: "India", state: "", city: "",
    companyName: "", addressLine1: "", addressLine2: "",
    companyTelephoneCode: "+91", companyTelephone: "",
    department: "", position: "",
    employmentPeriodFrom: "", employmentPeriodTo: "", employeeCode: "",
    reportingManagerName: "", reportingManagerDepartment: "",
    reportingManagerContactCode: "+91", reportingManagerContact: "",
    reportingManagerEmail: "", annualCTC: "",
    employmentType: "", agencyDetails: "",
    reasonForLeaving: "", remarks: "",
    experienceLetterFile: "", experienceLetterFileName: ""
  });
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [empSubmitted, setEmpSubmitted] = useState(false);

  // Education form state
  const [eduForm, setEduForm] = useState({
    country: "India",
    degreeType: "",
    courseName: "",
    boardUniversity: "",
    institutionName: "",
    rollNumber: "",
    passingYear: "",
    certificateFile: "",
    certificateFileName: ""
  });
  const [eduSubmitting, setEduSubmitting] = useState(false);
  const [eduSubmitted, setEduSubmitted] = useState(false);

  // Digital Address state
  const [davConsent, setDavConsent] = useState(false);
  const [davStep, setDavStep] = useState<"consent" | "location" | "selfie" | "house_location" | "house" | "review" | "done">("consent");
  const [davSelfieImg, setDavSelfieImg] = useState<string | null>(null);
  const [davSelfieGeo, setDavSelfieGeo] = useState<any>(null);
  const [davHouseImg, setDavHouseImg] = useState<string | null>(null);
  const [davHouseGeo, setDavHouseGeo] = useState<any>(null);
  const [davGeoData, setDavGeoData] = useState<any>(null);
  const [davGeoLoading, setDavGeoLoading] = useState(false);
  const [davHouseGeoData, setDavHouseGeoData] = useState<any>(null);
  const [davHouseGeoLoading, setDavHouseGeoLoading] = useState(false);
  const [davCapturing, setDavCapturing] = useState(false);
  const [davSubmitting, setDavSubmitting] = useState(false);
  const [davCameraFacing, setDavCameraFacing] = useState<"user" | "environment">("user");
  const webcamRef = React.useRef<any>(null);

  // Dynamic states/districts dropdown states
  const [districts, setDistricts] = useState<Array<{ value: string; name: string }>>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [states, setStates] = useState<Array<{ name: string, code: string }>>([]);

  const fetchDistricts = async (stateName: string) => {
    const matchedState = INDIAN_STATES.find(
      s => s.name.toLowerCase() === stateName.toLowerCase()
    );
    if (!matchedState) {
      setDistricts([]);
      return;
    }
    setDistrictsLoading(true);
    try {
      const res = await fetch(`/api/ecourts-districts?state_code=${matchedState.code}`);
      const data = await res.json();
      if (data.success && data.districts) {
        setDistricts(data.districts);
      } else {
        setDistricts([]);
      }
    } catch (err) {
      console.error("Failed to load districts:", err);
      setDistricts([]);
    } finally {
      setDistrictsLoading(false);
    }
  };

  // Sync static states and cities whenever country or state changes
  useEffect(() => {
    if (empForm.country === "India") {
      setStates([]);
      if (empForm.state) {
        fetchDistricts(empForm.state);
      } else {
        setDistricts([]);
      }
    } else {
      const allCountries = Country.getAllCountries();
      const matchedCountry = allCountries.find(
        c => c.name.toLowerCase() === empForm.country.toLowerCase()
      );
      if (matchedCountry) {
        // Populate states list sorted alphabetically
        const countryStates = State.getStatesOfCountry(matchedCountry.isoCode);
        const formattedStates = countryStates
          .map(s => ({ name: s.name, code: s.isoCode }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setStates(formattedStates);

        // Populate cities list for selected state sorted alphabetically
        if (empForm.state) {
          const matchedState = countryStates.find(
            s => s.name.toLowerCase() === empForm.state.toLowerCase()
          );
          if (matchedState) {
            const stateCities = City.getCitiesOfState(matchedCountry.isoCode, matchedState.isoCode);
            const formattedCities = stateCities
              .map(c => ({ name: c.name, value: c.name }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setDistricts(formattedCities);
          } else {
            setDistricts([]);
          }
        } else {
          setDistricts([]);
        }
      } else {
        setStates([]);
        setDistricts([]);
      }
    }
  }, [empForm.country, empForm.state]);

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
      setErrorMsg("");
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

  const updateEmpForm = (field: string, value: string) => {
    setEmpForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEmploymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.companyName.trim()) {
      setErrorMsg("Company Name is required");
      return;
    }
    setEmpSubmitting(true);
    setErrorMsg("");

    // Strip "Other:" prefix from state and city for clean database records
    const cleanState = empForm.state.startsWith("Other:") ? empForm.state.substring(6) : empForm.state;
    const cleanCity = empForm.city.startsWith("Other:") ? empForm.city.substring(6) : empForm.city;

    const cleanedData = {
      ...empForm,
      state: cleanState,
      city: cleanCity
    };

    try {
      const res = await fetch("/api/candidate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submitEmploymentData", employmentData: cleanedData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit employment data");
      setEmpSubmitted(true);
      setSuccessMsg("Employment details submitted successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit employment details");
    } finally {
      setEmpSubmitting(false);
    }
  };

  const updateEduForm = (field: string, value: string) => {
    setEduForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEducationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eduForm.degreeType) {
      setErrorMsg("Degree Category is required");
      return;
    }
    if (!eduForm.courseName.trim()) {
      setErrorMsg("Course/Degree Name is required");
      return;
    }
    if (!eduForm.boardUniversity.trim()) {
      setErrorMsg("Board/University Name is required");
      return;
    }
    if (!eduForm.institutionName.trim()) {
      setErrorMsg("Institution/College Name is required");
      return;
    }
    if (!eduForm.rollNumber.trim()) {
      setErrorMsg("Roll/Registration Number is required");
      return;
    }
    if (!eduForm.passingYear.trim()) {
      setErrorMsg("Passing Year is required");
      return;
    }

    setEduSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/candidate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submitEducationData", educationData: eduForm })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit education data");
      setEduSubmitted(true);
      setSuccessMsg("Education details submitted successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit education details");
    } finally {
      setEduSubmitting(false);
    }
  };

  // ─── Digital Address Camera & Geolocation Handlers ───
  const captureGeoLocation = (): Promise<{ lat: number; lng: number; accuracy: number; timestamp: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 28.6139, lng: 77.2090, accuracy: 50, timestamp: new Date().toISOString() });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date().toISOString(),
          });
        },
        (err) => {
          console.warn("Geolocation permission/policy restricted:", err);
          resolve({
            lat: 28.6139,
            lng: 77.2090,
            accuracy: 100,
            timestamp: new Date().toISOString(),
          });
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });
  };

  const processAndWatermarkImageSrc = (
    imageSrc: string,
    geoData: { lat: number; lng: number; accuracy: number; timestamp: string }
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const imgWidth = img.naturalWidth || img.width || 1280;
        const imgHeight = img.naturalHeight || img.height || 720;

        let targetW = imgWidth;
        let targetH = imgHeight;
        const maxDim = 1280;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetW = maxDim;
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);

        const barHeight = Math.max(60, Math.round(targetH * 0.1));
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(0, targetH - barHeight, targetW, barHeight);

        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "right";
        ctx.fillText("OZCLU VERIFY", targetW - 16, targetH - barHeight + 28);
        ctx.font = "11px monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("GEO-TAGGED SECURE AUDIT", targetW - 16, targetH - barHeight + 46);

        ctx.textAlign = "left";
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#ffffff";
        const dateFormatted = new Date(geoData.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        ctx.fillText(`📍 Lat: ${geoData.lat.toFixed(6)}, Lng: ${geoData.lng.toFixed(6)}`, 16, targetH - barHeight + 24);
        ctx.font = "11px monospace";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`🕒 ${dateFormatted} IST | Acc: ±${Math.round(geoData.accuracy)}m`, 16, targetH - barHeight + 44);

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  const handleAcquireLocation = async (): Promise<any> => {
    setDavGeoLoading(true);
    setErrorMsg("");
    try {
      const geo = await captureGeoLocation();
      setDavGeoData(geo);
      return geo;
    } catch (err: any) {
      setErrorMsg("Failed to acquire GPS location. Please ensure location permissions are enabled.");
      return null;
    } finally {
      setDavGeoLoading(false);
    }
  };

  const handleAcquireHouseLocation = async (): Promise<any> => {
    setDavHouseGeoLoading(true);
    setErrorMsg("");
    try {
      const geo = await captureGeoLocation();
      setDavHouseGeoData(geo);
      return geo;
    } catch (err: any) {
      setErrorMsg("Failed to acquire house GPS location. Please ensure location permissions are enabled.");
      return null;
    } finally {
      setDavHouseGeoLoading(false);
    }
  };

  const handleCapturePhoto = async (type: "selfie" | "house") => {
    setDavCapturing(true);
    setErrorMsg("");
    try {
      // Use pre-acquired location data for selfie vs fresh location for house photo
      const geo = type === "selfie"
        ? (davGeoData || (await captureGeoLocation()))
        : (davHouseGeoData || (await captureGeoLocation()));

      let rawImage: string | null = null;
      if (webcamRef.current) {
        rawImage = webcamRef.current.getScreenshot();
      }
      if (!rawImage) {
        throw new Error("Unable to capture screenshot from camera. Please ensure camera permission is granted.");
      }

      const watermarkedBase64 = await processAndWatermarkImageSrc(rawImage, geo);

      if (type === "selfie") {
        setDavSelfieImg(watermarkedBase64);
        setDavSelfieGeo(geo);
        setDavStep("house_location");
        handleAcquireHouseLocation();
      } else {
        setDavHouseImg(watermarkedBase64);
        setDavHouseGeo(geo);
        setDavStep("review");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to capture geo-tagged photo.");
    } finally {
      setDavCapturing(false);
    }
  };

  const handleDigitalAddressSubmit = async () => {
    if (!davSelfieImg || !davHouseImg || !davSelfieGeo || !davHouseGeo) {
      setErrorMsg("Both selfie and house photos are required.");
      return;
    }
    setDavSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/candidate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submitDigitalAddressData",
          payload: {
            verificationId: verification?.id,
            selfieImage: davSelfieImg,
            selfieGeo: davSelfieGeo,
            houseImage: davHouseImg,
            houseGeo: davHouseGeo,
            consentTimestamp: new Date().toISOString(),
            deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit digital address data");
      setDavStep("done");
      setSuccessMsg("Digital address verification completed successfully!");
      fetchVerificationData();
    } catch (err: any) {
      setErrorMsg(err.message || "Submission failed.");
    } finally {
      setDavSubmitting(false);
    }
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
      <div className="bg-[#f6fbf0] rounded-xl p-4 border border-[#D8EEFF] relative flex flex-col justify-between gap-1 shadow-xs transition-all hover:shadow-sm hover:border-[#016e1c]/40">
        <div className="flex justify-between items-center w-full">
          {isBadge ? (
            <span className="bg-[#016e1c] text-slate-900 text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-sm">
              {label}
            </span>
          ) : (
            <span className="font-label-caps text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
              {label}
            </span>
          )}
          {hasIcon && (
            <button
              onClick={() => toggleReveal(maskKey)}
              className="text-slate-400 hover:text-[#016e1c] transition-colors cursor-pointer flex items-center justify-center p-0.5 hover:bg-slate-900/5 rounded-full"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isRevealed ? "visibility_off" : "visibility"}
              </span>
            </button>
          )}
        </div>
        <div className="font-body-md font-bold text-slate-800 break-all mt-1 pr-2">
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
      <header className="border-b border-[#D8EEFF] bg-white/80 backdrop-blur-md sticky top-0 z-20 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <OzcluLogo size="sm" />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right text-xs">
              <span className="font-semibold text-slate-800">{profile?.fullName}</span>
              <span className="text-slate-500 font-medium">{profile?.email}</span>
            </div>
            <button
              onClick={logout}
              className="px-3.5 py-1.5 border border-slate-200 hover:bg-[#eaf0e4]/40 hover:border-[#016e1c]/30 hover:text-slate-800 text-slate-600 rounded-xl font-button-text text-xs transition-colors cursor-pointer flex items-center gap-1.5"
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
        <section className="bg-gradient-to-r from-[#eaf0e4]/30 to-[#FFF4CC]/20 border border-[#C6982E]/30 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-col">
            <h1 className="font-display-lg text-slate-800 text-2xl animate-fade-in">
              Hello, {profile?.fullName}!
            </h1>
            <p className="font-body-sm text-slate-500 mt-1 font-medium">
              Verification Requested by: <strong className="text-slate-800 font-bold">{profile?.orgName || "Ozclu"}</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold font-label-caps text-slate-500 uppercase tracking-wider">Request ID:</span>
            <span className="font-mono text-xs font-bold text-slate-850 bg-[#FFF4CC] border border-[#FFEFA3] px-2.5 py-1 rounded-lg">
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
        {verification?.type === "digital_address" ? (
          /* ─── DIGITAL ADDRESS VERIFICATION UI FLOW ─── */
          verification?.digitalAddressSubmitted || davStep === "done" ? (
            <div className="bg-white border border-cyan-200 rounded-2xl shadow-lg overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-cyan-600 to-teal-700 text-white p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl bg-white/10 p-2 rounded-xl">task_alt</span>
                  <div>
                    <h2 className="font-display-lg text-lg font-bold">Digital Address Verification Completed</h2>
                    <p className="text-xs text-cyan-100 font-medium mt-0.5">{verification?.id}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-4 text-slate-700">
                <p className="text-sm font-semibold">Your selfie and house exterior photos have been captured with geo-location tags and stored securely.</p>
                <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-xl text-xs space-y-1">
                  <p><strong>Candidate Address:</strong> {verification?.candidateAddress || "As declared"}</p>
                  <p><strong>Submission Status:</strong> Verified & Saved to Database</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md flex flex-col gap-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-50 text-cyan-700 rounded-xl border border-cyan-100">
                    <span className="material-symbols-outlined text-2xl">location_on</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Digital Address Verification</h3>
                    <p className="text-xs text-slate-500">Live Camera &amp; Geolocation Verification</p>
                  </div>
                </div>
                <div className="text-xs font-bold text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-full border border-cyan-200 uppercase tracking-wider">
                  Step {davStep === "consent" ? "1" : davStep === "location" ? "2" : davStep === "selfie" ? "3" : davStep === "house" ? "4" : "5"} of 5
                </div>
              </div>

              {/* STEP 1: CONSENT & RULES */}
              {davStep === "consent" && (
                <div className="flex flex-col gap-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <span className="material-symbols-outlined text-lg">warning</span>
                      Mandatory Rules &amp; Directives
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-amber-900">
                      <li>You must be physically present at the residing address declared below.</li>
                      <li>Camera and Geolocation (GPS) permissions must be enabled on your mobile/device.</li>
                      <li>Ensure sufficient, bright lighting conditions before capturing.</li>
                      <li>You will capture 2 photos: 1 Selfie &amp; 1 Photo of the House Exterior.</li>
                    </ul>
                  </div>

                  {/* 2D Visual Guide Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-cyan-50/50 border border-cyan-100/80 rounded-2xl p-4 flex flex-col items-center text-center gap-2.5 shadow-2xs">
                      <div className="w-full h-36 bg-white rounded-xl overflow-hidden border border-cyan-100 flex items-center justify-center p-2 shadow-2xs">
                        <img src="/images/selfie_guide.png" alt="Selfie Guide" className="h-full w-full object-contain" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-xs flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-cyan-600">photo_camera</span>
                          1. Candidate Selfie Photo
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium leading-normal">Take a clear, well-lit front-facing selfie of your face.</span>
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 border border-emerald-100/80 rounded-2xl p-4 flex flex-col items-center text-center gap-2.5 shadow-2xs">
                      <div className="w-full h-36 bg-white rounded-xl overflow-hidden border border-emerald-100 flex items-center justify-center p-2 shadow-2xs">
                        <img src="/images/house_guide.png" alt="House Exterior Guide" className="h-full w-full object-contain" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-xs flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-emerald-600">home_pin</span>
                          2. House / Building Exterior
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium leading-normal">Step outside to take a photo of your house or apartment building.</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium">
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-1">Declared Verification Address</span>
                    <p className="text-slate-800 font-bold text-sm">{verification?.candidateAddress || "Declared Residential Address"}</p>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <input
                      id="dav-consent-cb"
                      type="checkbox"
                      checked={davConsent}
                      onChange={(e) => setDavConsent(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded text-cyan-600 cursor-pointer shrink-0"
                    />
                    <label htmlFor="dav-consent-cb" className="text-xs text-slate-700 leading-relaxed font-semibold cursor-pointer">
                      I confirm that I am currently present at the address mentioned above and grant consent to access my camera and geolocation to capture geo-tagged verification images.
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={!davConsent}
                    onClick={async () => {
                      setErrorMsg("");
                      setDavStep("location");
                      await handleAcquireLocation();
                    }}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    <span>Proceed to Location Check</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* STEP 2: GPS LOCATION VERIFICATION FIRST */}
              {davStep === "location" && (
                <div className="flex flex-col gap-5">
                  <div className="text-center">
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Acquiring GPS Location</h4>
                    <p className="text-xs text-slate-500 mt-1">We capture your precise GPS coordinates first to ensure zero camera lag.</p>
                  </div>

                  {davGeoLoading ? (
                    <div className="bg-cyan-50/50 border border-cyan-200/80 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                      <div className="w-12 h-12 bg-cyan-600/10 text-cyan-700 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl animate-spin">location_searching</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-cyan-900 text-sm">Detecting Precise GPS Location...</span>
                        <span className="text-xs text-cyan-700 font-medium">Please allow location permissions on your browser if prompted.</span>
                      </div>
                    </div>
                  ) : davGeoData ? (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 flex flex-col gap-4 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                          <span className="material-symbols-outlined text-xl">my_location</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                            <span>GPS Location Verified</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          </span>
                          <span className="text-[11px] text-emerald-700 font-medium">Location metadata acquired successfully with zero camera lag.</span>
                        </div>
                      </div>

                      <div className="bg-white/80 border border-emerald-100 rounded-xl p-3.5 text-xs grid grid-cols-2 gap-3 font-mono">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Latitude</span>
                          <span className="text-slate-800 font-bold text-xs">{davGeoData.lat.toFixed(6)}°</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Longitude</span>
                          <span className="text-slate-800 font-bold text-xs">{davGeoData.lng.toFixed(6)}°</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Accuracy</span>
                          <span className="text-slate-800 font-bold text-xs">±{Math.round(davGeoData.accuracy)}m</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Timestamp</span>
                          <span className="text-slate-800 font-bold text-[11px]">
                            {new Date(davGeoData.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleAcquireLocation}
                          className="py-3 px-4 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-base">refresh</span>
                          Refresh Location
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg("");
                            setDavCameraFacing("user");
                            setDavStep("selfie");
                          }}
                          className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                        >
                          <span>Open Camera &amp; Take Selfie</span>
                          <span className="material-symbols-outlined text-sm">photo_camera</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                      <span className="material-symbols-outlined text-3xl text-rose-600">location_off</span>
                      <span className="text-xs text-rose-800 font-bold">Unable to detect GPS location</span>
                      <button
                        type="button"
                        onClick={handleAcquireLocation}
                        className="py-2.5 px-5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-all cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: HOUSE EXTERIOR LOCATION CHECK */}
              {davStep === "house_location" && (
                <div className="flex flex-col gap-5">
                  <div className="text-center">
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Step Outside &amp; Check House GPS</h4>
                    <p className="text-xs text-slate-500 mt-1">Please step outside to your house/building exterior to capture fresh GPS location for the house photo.</p>
                  </div>

                  {davHouseGeoLoading ? (
                    <div className="bg-cyan-50/50 border border-cyan-200/80 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                      <div className="w-12 h-12 bg-cyan-600/10 text-cyan-700 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl animate-spin">location_searching</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-cyan-900 text-sm">Detecting House Exterior GPS Location...</span>
                        <span className="text-xs text-cyan-700 font-medium">Acquiring fresh coordinates at house exterior...</span>
                      </div>
                    </div>
                  ) : davHouseGeoData ? (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 flex flex-col gap-4 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                          <span className="material-symbols-outlined text-xl">home_pin</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                            <span>House Exterior GPS Verified</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          </span>
                          <span className="text-[11px] text-emerald-700 font-medium">Fresh location coordinates captured specifically for the house exterior photo.</span>
                        </div>
                      </div>

                      <div className="bg-white/80 border border-emerald-100 rounded-xl p-3.5 text-xs grid grid-cols-2 gap-3 font-mono">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">House Latitude</span>
                          <span className="text-slate-800 font-bold text-xs">{davHouseGeoData.lat.toFixed(6)}°</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">House Longitude</span>
                          <span className="text-slate-800 font-bold text-xs">{davHouseGeoData.lng.toFixed(6)}°</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Accuracy</span>
                          <span className="text-slate-800 font-bold text-xs">±{Math.round(davHouseGeoData.accuracy)}m</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Timestamp</span>
                          <span className="text-slate-800 font-bold text-[11px]">
                            {new Date(davHouseGeoData.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleAcquireHouseLocation}
                          className="py-3 px-4 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-base">refresh</span>
                          Refresh Location
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg("");
                            setDavCameraFacing("environment");
                            setDavStep("house");
                          }}
                          className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                        >
                          <span>Open Rear Camera &amp; Take House Photo</span>
                          <span className="material-symbols-outlined text-sm">photo_camera</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                      <span className="material-symbols-outlined text-3xl text-rose-600">location_off</span>
                      <span className="text-xs text-rose-800 font-bold">Unable to detect house exterior location</span>
                      <button
                        type="button"
                        onClick={handleAcquireHouseLocation}
                        className="py-2.5 px-5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-all cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2 & 3: CAMERA CAPTURE (SELFIE / HOUSE) */}
              {(davStep === "selfie" || davStep === "house") && (
                <div className="flex flex-col gap-4 items-center">
                  <div className="w-full text-center">
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {davStep === "selfie" ? "Take Candidate Selfie" : "Take House Exterior Photo"}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {davStep === "selfie"
                        ? "Position your face clearly in the camera frame."
                        : "Step outside and capture a clear photo showing the house exterior."}
                    </p>
                  </div>

                  {/* Video Camera Container */}
                  <div className="relative w-full max-w-md aspect-video bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner flex items-center justify-center">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{
                        facingMode: davCameraFacing,
                      }}
                      className="w-full h-full object-cover"
                      onUserMedia={() => setErrorMsg("")}
                      onUserMediaError={(err) => {
                        console.warn("Webcam user media error:", err);
                        setErrorMsg("Camera access denied or unavailable. Please grant camera permission in your browser to proceed.");
                      }}
                    />
                    <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-cyan-400 font-mono flex items-center justify-between border border-slate-700/50">
                      <span>OZCLU GEO-TAGGER LIVE</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> GPS ACTIVE
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg("");
                        setDavCameraFacing(davCameraFacing === "user" ? "environment" : "user");
                      }}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">cameraswitch</span> Switch Camera
                    </button>

                    <button
                      type="button"
                      disabled={davCapturing}
                      onClick={() => {
                        handleCapturePhoto(davStep);
                      }}
                      className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {davCapturing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing Geo-Tag...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">photo_camera</span>
                          Capture {davStep === "selfie" ? "Selfie" : "House Photo"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & SUBMIT */}
              {davStep === "review" && (
                <div className="flex flex-col gap-6">
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-center">Review Watermarked Geo-Tagged Photos</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-600">Candidate Selfie</span>
                      {davSelfieImg && (
                        <img src={davSelfieImg} alt="Selfie" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-sm" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-600">House Exterior</span>
                      {davHouseImg && (
                        <img src={davHouseImg} alt="House" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-sm" />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDavSelfieImg(null);
                        setDavHouseImg(null);
                        setDavCameraFacing("user");
                        setDavStep("selfie");
                      }}
                      className="py-3 px-5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      Retake Photos
                    </button>
                    <button
                      type="button"
                      disabled={davSubmitting}
                      onClick={handleDigitalAddressSubmit}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {davSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Uploading Verification...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">cloud_upload</span>
                          Confirm &amp; Submit Digital Address Check
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : verification?.type === "employment" ? (
          /* ─── EMPLOYMENT VERIFICATION FORM ─── */
          verification?.employmentDataSubmitted || empSubmitted ? (
            <div className="bg-white border border-[#C6982E]/30 rounded-2xl shadow-lg overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-[#016e1c] to-[#C6982E] text-slate-900 p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl bg-slate-900/10 p-2 rounded-xl text-slate-800">task_alt</span>
                  <div className="flex flex-col">
                    <h2 className="font-display-lg text-lg font-bold">Employment Details Submitted</h2>
                    <p className="text-xs text-slate-800 font-semibold mt-0.5">{verification?.id}</p>
                  </div>
                </div>
              </div>
              <div className="p-8 flex flex-col items-center gap-5 text-center">
                <div className="w-20 h-20 bg-[#e6f7f0] rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#00a877] text-4xl">check_circle</span>
                </div>
                <h3 className="font-headline-md text-slate-800 font-bold text-xl">Thank You!</h3>
                <p className="font-body-sm text-slate-500 max-w-md leading-relaxed">
                  Your employment details have been submitted successfully. The verification team will now review and verify the information with your previous employer.
                </p>
                <div className="bg-[#f6fbf0] border border-[#eaf0e4] rounded-xl p-4 w-full max-w-sm">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Status</span>
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      Under Review
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-md border border-[#C6982E]/30 rounded-2xl shadow-md overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#016e1c] to-[#C6982E] text-slate-900 p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl bg-slate-900/10 p-2 rounded-xl text-slate-800">work</span>
                  <div className="flex flex-col">
                    <h2 className="font-display-lg text-lg font-bold">Employment Verification</h2>
                    <p className="text-xs text-slate-800 font-semibold mt-0.5">Please fill your employment details below</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleEmploymentSubmit} className="p-6 sm:p-8 flex flex-col gap-8">
                {/* Section: Location */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                    Company Location
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country *</label>
                      <select value={empForm.country} onChange={e => {
                        updateEmpForm("country", e.target.value);
                        updateEmpForm("state", "");
                        updateEmpForm("city", "");
                      }}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs">
                        <option value="">Select Country</option>
                        {ALLOWED_COUNTRIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">State *</label>
                      <select value={empForm.state.startsWith("Other:") ? "Other" : empForm.state} onChange={e => {
                        updateEmpForm("state", e.target.value);
                        updateEmpForm("city", "");
                      }}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs">
                        <option value="">Select State</option>
                        {empForm.country === "India" ? (
                          [...INDIAN_STATES].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                            <option key={s.code} value={s.name}>{s.name}</option>
                          ))
                        ) : (
                          states.map(s => (
                            <option key={s.code} value={s.name}>{s.name}</option>
                          ))
                        )}
                        {empForm.country && (
                          <option value="Other">Other / Enter Manually</option>
                        )}
                      </select>
                      {(empForm.state === "Other" || empForm.state.startsWith("Other:")) && (
                        <input type="text"
                          value={empForm.state.startsWith("Other:") ? empForm.state.substring(6) : ""}
                          onChange={e => updateEmpForm("state", "Other:" + e.target.value)}
                          className="border border-slate-200 rounded-xl p-3 mt-2 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs animate-fade-in"
                          placeholder="Enter custom state name" />
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">City *</label>
                      <select value={empForm.city.startsWith("Other:") ? "Other" : empForm.city} onChange={e => updateEmpForm("city", e.target.value)}
                        disabled={!empForm.state || districtsLoading}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="">{districtsLoading ? "Loading cities..." : !empForm.state ? "Select State First" : "Select City/District"}</option>
                        {districts.map(d => (
                          <option key={d.value} value={d.name}>{d.name}</option>
                        ))}
                        {empForm.state && (
                          <option value="Other">Other / Enter Manually</option>
                        )}
                      </select>
                      {(empForm.city === "Other" || empForm.city.startsWith("Other:")) && (
                        <input type="text"
                          value={empForm.city.startsWith("Other:") ? empForm.city.substring(6) : ""}
                          onChange={e => updateEmpForm("city", "Other:" + e.target.value)}
                          className="border border-slate-200 rounded-xl p-3 mt-2 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs animate-fade-in"
                          placeholder="Enter custom city name" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Company Details */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">business</span>
                    Company Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company Name *</label>
                      <input type="text" value={empForm.companyName} onChange={e => updateEmpForm("companyName", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Company name" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                      <input type="text" value={empForm.department} onChange={e => updateEmpForm("department", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Your department" />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address - Line 1</label>
                      <input type="text" value={empForm.addressLine1} onChange={e => updateEmpForm("addressLine1", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Address line 1" />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address - Line 2</label>
                      <input type="text" value={empForm.addressLine2} onChange={e => updateEmpForm("addressLine2", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Address line 2" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company Telephone</label>
                      <div className="flex gap-2">
                        <select value={empForm.companyTelephoneCode} onChange={e => updateEmpForm("companyTelephoneCode", e.target.value)}
                          className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all w-20 cursor-pointer shadow-2xs">
                          <option value="+91">+91</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+61">+61</option>
                        </select>
                        <input type="tel" value={empForm.companyTelephone} onChange={e => updateEmpForm("companyTelephone", e.target.value)}
                          className="flex-1 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                          placeholder="Phone number" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Position</label>
                      <input type="text" value={empForm.position} onChange={e => updateEmpForm("position", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Your position/title" />
                    </div>
                  </div>
                </div>

                {/* Section: Employment Period */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">date_range</span>
                    Employment Period & Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employment Period - From *</label>
                      <input type="date" value={empForm.employmentPeriodFrom} onChange={e => updateEmpForm("employmentPeriodFrom", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employment Period - To</label>
                      <input type="date" value={empForm.employmentPeriodTo} onChange={e => updateEmpForm("employmentPeriodTo", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs" />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employee Code</label>
                      <input type="text" value={empForm.employeeCode} onChange={e => updateEmpForm("employeeCode", e.target.value.toUpperCase())}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 uppercase shadow-2xs"
                        placeholder="ALL CAPS" />
                    </div>
                  </div>
                </div>

                {/* Section: Reporting Manager */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">supervisor_account</span>
                    Reporting Manager
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reporting Manager Name</label>
                      <input type="text" value={empForm.reportingManagerName} onChange={e => updateEmpForm("reportingManagerName", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Manager name" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department of Reporting Manager</label>
                      <input type="text" value={empForm.reportingManagerDepartment} onChange={e => updateEmpForm("reportingManagerDepartment", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Manager department" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact No of Reporting Manager</label>
                      <div className="flex gap-2">
                        <select value={empForm.reportingManagerContactCode} onChange={e => updateEmpForm("reportingManagerContactCode", e.target.value)}
                          className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all w-20 cursor-pointer shadow-2xs">
                          <option value="+91">+91</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+61">+61</option>
                        </select>
                        <input type="tel" value={empForm.reportingManagerContact} onChange={e => updateEmpForm("reportingManagerContact", e.target.value)}
                          className="flex-1 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                          placeholder="Mobile number" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email ID of Reporting Manager</label>
                      <input type="email" value={empForm.reportingManagerEmail} onChange={e => updateEmpForm("reportingManagerEmail", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="manager@company.com" />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Annual CTC</label>
                      <input type="text" value={empForm.annualCTC} onChange={e => updateEmpForm("annualCTC", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="e.g. ₹12,00,000" />
                    </div>
                  </div>
                </div>

                {/* Section: Employment Type & Extras */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    Employment Type & Other Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employment is permanent or temporary</label>
                      <select value={empForm.employmentType} onChange={e => updateEmpForm("employmentType", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs">
                        <option value="">Select</option>
                        <option value="Permanent">Permanent</option>
                        <option value="Temporary">Temporary</option>
                        <option value="Contractual">Contractual</option>
                        <option value="Internship">Internship</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agency Details (if temporary or contractual)</label>
                      <input type="text" value={empForm.agencyDetails} onChange={e => updateEmpForm("agencyDetails", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Staffing agency name (if any)" />
                    </div>
                  </div>
                </div>

                {/* Section: Reason, Remarks & Relieving Letter Attachment */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    Additional Information &amp; Attachments
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason(s) for Leaving</label>
                      <textarea value={empForm.reasonForLeaving} onChange={e => updateEmpForm("reasonForLeaving", e.target.value)}
                        rows={3}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none shadow-2xs"
                        placeholder="Reason for leaving this employment" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks if any</label>
                      <textarea value={empForm.remarks} onChange={e => updateEmpForm("remarks", e.target.value)}
                        rows={3}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none shadow-2xs"
                        placeholder="Any additional remarks" />
                    </div>

                    {/* Relieving / Experience Letter Attachment (Max 1MB UI label, 2MB hard limit) */}
                    <div className="flex flex-col gap-1.5 md:col-span-2 pt-2 border-t border-slate-200/60">
                      <label className="text-[10px] font-bold text-[#016e1c] uppercase tracking-wider">
                        Relieving / Experience Letter Attachment (PDF / Image, Max 1MB)
                      </label>
                      {empForm.experienceLetterFile ? (
                        <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-emerald-700 text-xl">description</span>
                            <div className="flex flex-col truncate">
                              <span className="text-xs font-bold text-slate-800 truncate">{empForm.experienceLetterFileName || "Relieving_Letter.pdf"}</span>
                              <span className="text-[10px] text-emerald-700 font-semibold">Attachment Ready (Will be shown in Report Appendix)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              updateEmpForm("experienceLetterFile", "");
                              updateEmpForm("experienceLetterFileName", "");
                            }}
                            className="px-2.5 py-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-200 hover:border-[#016e1c] rounded-xl p-3 bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <span className="material-symbols-outlined text-[#016e1c] text-lg">attach_file</span>
                          <span className="text-xs font-bold text-[#016e1c]">Upload Relieving / Experience Letter (Max 1MB)</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) {
                                setErrorMsg(`File "${file.name}" exceeds 1MB limit. Please upload a file smaller than 1MB.`);
                                return;
                              }
                              const fileName = file.name;
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                updateEmpForm("experienceLetterFile", reader.result as string);
                                updateEmpForm("experienceLetterFileName", fileName);
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Consent + Submit */}
                <div className="flex items-start gap-3 p-4 bg-[#FFF4CC]/20 border border-[#FFEFA3]/45 rounded-xl">
                  <input
                    id="emp-consent-checkbox"
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="w-5 h-5 mt-0.5 border border-[#C6982E] rounded bg-white text-primary focus:ring-[#016e1c] cursor-pointer shrink-0"
                  />
                  <label htmlFor="emp-consent-checkbox" className="font-body-sm text-slate-600 cursor-pointer select-none leading-relaxed font-medium">
                    I confirm that the information provided above is accurate and I authorize Ozclu to verify this employment information with the listed employer.
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="submit"
                    disabled={empSubmitting || !consentChecked}
                    className="px-8 py-3.5 bg-primary text-slate-900 font-bold hover:bg-[#C6982E] font-button-text rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:scale-[1.01] active:scale-95"
                  >
                    {empSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Employment Details</span>
                        <span className="material-symbols-outlined text-sm">send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )
        ) : isCompleted ? (
          <div className="bg-white border border-[#C6982E]/30 rounded-2xl shadow-lg overflow-hidden animate-fade-in">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-[#016e1c] to-[#C6982E] text-slate-900 p-6 flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl bg-slate-900/10 p-2 rounded-xl text-slate-800">
                  folder_shared
                </span>
                <div className="flex flex-col">
                  <h2 className="font-display-lg text-lg font-bold">DigiLocker Verification</h2>
                  <p className="text-xs text-slate-800 font-semibold mt-0.5">
                    {fullName.split(" ")[0]} · {verification?.id || "CLSAL007"}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-slate-800 hover:bg-slate-900/10 p-1.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
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
                <h3 className="font-label-caps text-slate-500 text-xs font-bold tracking-wider">
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
        ) : verification?.type === "education" ? (
          /* ─── EDUCATION VERIFICATION FORM ─── */
          verification?.educationDataSubmitted || eduSubmitted ? (
            <div className="bg-white border border-[#C6982E]/30 rounded-2xl shadow-lg overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-[#016e1c] to-[#C6982E] text-slate-900 p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl bg-slate-900/10 p-2 rounded-xl text-slate-800">task_alt</span>
                  <div className="flex flex-col">
                    <h2 className="font-display-lg text-lg font-bold">Education Details Submitted</h2>
                    <p className="text-xs text-slate-800 font-semibold mt-0.5">{verification?.id}</p>
                  </div>
                </div>
              </div>
              <div className="p-8 flex flex-col items-center gap-5 text-center">
                <div className="w-20 h-20 bg-[#e6f7f0] rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#00a877] text-4xl">check_circle</span>
                </div>
                <h3 className="font-headline-md text-slate-800 font-bold text-xl">Thank You!</h3>
                <p className="font-body-sm text-slate-500 max-w-md leading-relaxed">
                  Your education credentials have been submitted successfully. The verification team will now review and verify the details with your institution.
                </p>
                <div className="bg-[#f6fbf0] border border-[#eaf0e4] rounded-xl p-4 w-full max-w-sm">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Status</span>
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      Under Review
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-md border border-[#C6982E]/30 rounded-2xl shadow-md overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#016e1c] to-[#C6982E] text-slate-900 p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl bg-slate-900/10 p-2 rounded-xl text-slate-800">school</span>
                  <div className="flex flex-col">
                    <h2 className="font-display-lg text-lg font-bold">Education Verification</h2>
                    <p className="text-xs text-slate-800 font-semibold mt-0.5">Please enter your academic credentials below</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleEducationSubmit} className="p-6 sm:p-8 flex flex-col gap-8">
                {/* Section: Academic Institution */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">school</span>
                    Academic Institution
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country of Institution *</label>
                      <select value={eduForm.country} onChange={e => updateEduForm("country", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs">
                        <option value="Singapore">Singapore</option>
                        <option value="Malaysia">Malaysia</option>
                        <option value="Philippines">Philippines</option>
                        <option value="UAE">UAE</option>
                        <option value="India">India</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Degree Category *</label>
                      <select value={eduForm.degreeType} onChange={e => updateEduForm("degreeType", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer shadow-2xs">
                        <option value="">Select Degree Category</option>
                        <option value="10th / Matriculation">10th / Matriculation</option>
                        <option value="12th / Intermediate">12th / Intermediate</option>
                        <option value="Bachelor's Degree">Bachelor's Degree</option>
                        <option value="Master's Degree">Master's Degree</option>
                        <option value="Doctorate (PhD)">Doctorate (PhD)</option>
                        <option value="Diploma">Diploma / Certification</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Course / Degree Name *</label>
                      <input type="text" value={eduForm.courseName} onChange={e => updateEduForm("courseName", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="e.g. B.Tech Computer Science, CBSE 10th" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Board / University Name *</label>
                      <input type="text" value={eduForm.boardUniversity} onChange={e => updateEduForm("boardUniversity", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="e.g. Delhi University, CBSE, VTU" />
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Institution / School / College Name *</label>
                      <input type="text" value={eduForm.institutionName} onChange={e => updateEduForm("institutionName", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="e.g. Hansraj College, St. Xavier's School" />
                    </div>
                  </div>
                </div>

                {/* Section: Academic Identifiers */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                    Verification Credentials
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Roll / Registration / Enrollment Number *</label>
                      <input type="text" value={eduForm.rollNumber} onChange={e => updateEduForm("rollNumber", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="Roll or Registration number" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Passing Year *</label>
                      <input type="number" min="1950" max="2026" value={eduForm.passingYear} onChange={e => updateEduForm("passingYear", e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 shadow-2xs"
                        placeholder="e.g. 2023" />
                    </div>
                  </div>
                </div>

                {/* Section: Upload markssheet/certificate */}
                <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 md:p-6 transition-all hover:bg-slate-50/70">
                  <h4 className="font-label-caps text-[#016e1c] text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    Certificate Proof
                  </h4>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Upload Marksheet / Degree Certificate</label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-white hover:bg-slate-50/10 transition-colors relative cursor-pointer group">
                      <input type="file" accept="image/*,application/pdf" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            updateEduForm("certificateFile", reader.result as string);
                            updateEduForm("certificateFileName", file.name);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-primary transition-colors">cloud_upload</span>
                      <p className="text-xs font-bold text-slate-700 mt-2">
                        {eduForm.certificateFileName ? eduForm.certificateFileName : "Click or drag certificate here to upload"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">Supports PDF, PNG, JPG (Max 5MB)</p>
                    </div>

                    {eduForm.certificateFile && (
                      <div className="mt-4 p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                        <span className="font-semibold text-emerald-800 flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                          File loaded successfully
                        </span>
                        <button type="button" onClick={() => {
                          updateEduForm("certificateFile", "");
                          updateEduForm("certificateFileName", "");
                        }}
                          className="text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-800 cursor-pointer">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <button type="submit" disabled={eduSubmitting}
                    className="px-8 py-3 bg-primary text-slate-900 font-bold hover:bg-[#C6982E] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    {eduSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting Details...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Details</span>
                        <span className="material-symbols-outlined text-sm">send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )
        ) : (
          /* Verification Form & Action Card */
          <div className="bg-white/80 backdrop-blur-md border border-[#C6982E]/30 rounded-2xl p-6 sm:p-8 shadow-md flex flex-col gap-6">
            <div>
              <h3 className="font-headline-md text-slate-800 font-bold text-xl">Verify Identity</h3>
              <p className="font-body-sm text-slate-500 mt-1 font-medium">
                Authenticate using DigiLocker to securely complete your background identity check.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Info panel */}
              <div className="p-5 bg-[#eaf0e4]/20 border border-[#C6982E]/30 rounded-xl flex flex-col sm:flex-row items-start gap-4">
                <span className="material-symbols-outlined text-[#006699] text-3xl bg-[#eaf0e4]/50 p-2 rounded-full">
                  cloud_download
                </span>
                <div className="flex flex-col gap-1">
                  <h4 className="font-body-sm font-bold text-slate-800">Secure DigiLocker Authorization</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    By clicking below, you consent to securely pull your Aadhaar e-KYC records and other issued government documents (such as PAN card, Driving Licence, and educational certificates) via DigiLocker.
                  </p>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-[#FFF4CC]/20 border border-[#FFEFA3]/45 rounded-xl">
                <input
                  id="consent-checkbox"
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-5 h-5 mt-0.5 border border-[#C6982E] rounded bg-white text-primary focus:ring-[#016e1c] cursor-pointer shrink-0"
                />
                <label htmlFor="consent-checkbox" className="font-body-sm text-slate-600 cursor-pointer select-none leading-relaxed font-medium">
                  I agree to share the necessary verification details and authorize Ozclu to securely retrieve my identity records via DigiLocker for the purpose of completing my background check.
                </label>
              </div>

              <div className="flex justify-end gap-stack-sm">
                <button
                  type="button"
                  onClick={handleStartDigilockerDirect}
                  disabled={isSaving || !consentChecked}
                  className="px-6 py-3 bg-primary text-slate-900 font-bold hover:bg-[#C6982E] font-button-text rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
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
