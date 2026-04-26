import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

export function AuthFlow() {
  const authStep = useAuthStore((s) => s.authStep);
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0e1621] px-4">
      <div className="w-full max-w-sm sm:max-w-md relative overflow-hidden">
        <div key={authStep} className="animate-pop-in w-full">
          {authStep === "email" && <EmailStep />}
          {authStep === "otp" && <OtpStep />}
          {authStep === "profile" && <ProfileStep />}
        </div>
      </div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────── */

function IconWave({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="20" fill="#2e7d5b" />
      <path d="M10 20c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M10 24c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/* ── Step 1: Email ──────────────────────────────────── */

function EmailStep() {
  const [email, setEmail] = useState("");
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const loading = useAuthStore((s) => s.loading);
  const otpError = useAuthStore((s) => s.otpError);
  const [localError, setLocalError] = useState("");

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) { setLocalError("Enter a valid email address"); return; }
    setLocalError("");
    await sendOtp(email);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <IconWave size={56} />
        <h1 className="text-2xl font-semibold text-white">Wave 2.0</h1>
        <p className="text-sm text-[#6b8299]">Enter your email to sign in</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-[#1c2733] px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#4a6580" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 6l8 5 8-5" />
          </svg>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setLocalError(""); }}
            placeholder="you@example.com"
            className="flex-1 bg-transparent text-sm text-white placeholder-[#4a6580] outline-none"
            autoFocus
            aria-label="Email address"
          />
        </div>

        {(localError || otpError) && (
          <p className="text-xs text-red-400 text-center" role="alert">{localError || otpError}</p>
        )}

        <p className="text-center text-xs text-[#4a6580]">
          We'll send a verification code to your email
        </p>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7eb88a] py-3 text-sm font-semibold text-[#0e1621] transition hover:bg-[#6da879] disabled:opacity-40"
        >
          {loading ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
            </svg>
          ) : "Continue →"}
        </button>
      </form>
    </div>
  );
}

/* ── Step 2: OTP ────────────────────────────────────── */

function OtpStep() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const email = useAuthStore((s) => s.email);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const loading = useAuthStore((s) => s.loading);
  const otpError = useAuthStore((s) => s.otpError);
  const setAuthStep = useAuthStore((s) => s.setAuthStep);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInput = async (i: number, val: string) => {
    if (isVerifying) return;
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    
    if (char && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }

    if (next.every(d => d !== "") && !isVerifying) {
      setIsVerifying(true);
      try {
        await verifyOtp(next.join(""));
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((c, i) => { if (i < 6) next[i] = c; });
    setDigits(next);
    
    if (pasted.length === 6 && !isVerifying) {
      setIsVerifying(true);
      try {
        await verifyOtp(pasted);
      } finally {
        setIsVerifying(false);
      }
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1c2733]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 6.5L22 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Check your email</h1>
        <p className="text-sm text-[#6b8299] text-center">
          We sent a 6-digit code to<br />
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`h-14 w-12 rounded-xl text-center text-xl font-bold text-white outline-none transition border-2 ${
              d ? "bg-[#1b3a2d] border-[#7eb88a]/60" : "bg-[#1c2733] border-[#2a3a4a]"
            } focus:border-[#7eb88a]`}
          />
        ))}
      </div>

      {otpError && (
        <p className="text-xs text-red-400 text-center" role="alert">{otpError}</p>
      )}

      {loading && !otpError && (
        <div className="flex justify-center py-2">
          <div className="flex items-center gap-2 text-[#7eb88a]">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] uppercase tracking-widest font-bold">Verifying</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 text-center">
        <button
          onClick={() => sendOtp(email)}
          disabled={loading}
          className="text-xs text-[#7eb88a] hover:underline disabled:opacity-40"
        >
          Resend code
        </button>
        <button
          onClick={() => {
            useAuthStore.getState().sendCodeViaBot();
          }}
          disabled={loading}
          className="text-xs text-[#6b8299] hover:text-[#7eb88a] transition disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 40 40" fill="none">
            <path d="M10 20c3-5 6 5 10 0s6 5 10 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Send code via Wave
        </button>
        <button
          onClick={() => setAuthStep("email")}
          className="text-xs text-[#4a6580] hover:text-[#6b8299] transition"
        >
          ← Change email
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Profile ────────────────────────────────── */

function ProfileStep() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const loading = useAuthStore((s) => s.loading);
  const otpError = useAuthStore((s) => s.otpError);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    const username = firstName.trim().toLowerCase().replace(/\s+/g, "");
    await saveProfile(name, username, avatarDataUrl);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-white">Your Profile</h1>
        <p className="mt-1 text-sm text-[#6b8299]">Add a photo and your name</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative">
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover ring-2 ring-[#7eb88a]/30 transition group-hover:ring-[#7eb88a]" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#1c2733] text-xl font-bold text-[#4a6580] ring-2 ring-dashed ring-[#2a3a4a] transition group-hover:ring-[#7eb88a]/50">
                {initials || (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9a2 2 0 012-2h1l2-2h4l2 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" />
                  </svg>
                )}
              </div>
            )}
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#2e7d5b] text-white shadow-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9a2 2 0 012-2h1l2-2h4l2 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" />
              </svg>
            </span>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-[#7eb88a] hover:underline">
            {avatarDataUrl ? "Change photo" : "Upload photo"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        </div>

        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="w-full rounded-xl bg-[#1c2733] px-4 py-3 text-sm text-white placeholder-[#4a6580] outline-none transition focus:ring-2 focus:ring-[#7eb88a]/50"
          autoFocus
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name (optional)"
          className="w-full rounded-xl bg-[#1c2733] px-4 py-3 text-sm text-white placeholder-[#4a6580] outline-none transition focus:ring-2 focus:ring-[#7eb88a]/50"
        />

        {otpError && <p className="text-xs text-red-400 text-center">{otpError}</p>}

        <button
          type="submit"
          disabled={!firstName.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7eb88a] py-3 text-sm font-semibold text-[#0e1621] transition hover:bg-[#6da879] disabled:opacity-40"
        >
          {loading ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
            </svg>
          ) : "Start Messaging →"}
        </button>
      </form>

      <button
        onClick={() => useAuthStore.getState().setAuthStep("otp")}
        className="flex w-full items-center justify-center gap-2 text-xs text-[#4a6580] transition hover:text-[#6b8299]"
      >
        ← Back
      </button>
    </div>
  );
}
