import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/utils/cn";

export function AuthFlow() {
  const authStep = useAuthStore((s) => s.authStep);
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0e1621] px-4">
      <div className="w-full max-w-sm sm:max-w-md relative overflow-hidden">
        <div key={authStep} className="animate-pop-in w-full">
          {authStep === "email" && <EmailStep />}
          {authStep === "otp" && <OtpStep />}
          {authStep === "profile" && <ProfileStep />}
          {authStep === "forgot-password" && <ForgotPasswordStep />}
          {authStep === "reset-password" && <ResetPasswordStep />}
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

function IconEye({ open, className, ...props }: { open: boolean } & React.SVGProps<SVGSVGElement>) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconCheck({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Password Strength ──────────────────────────────── */

function getPasswordStrength(password: string) {
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least 1 uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least 1 number", met: /[0-9]/.test(password) },
    { label: "At least 1 special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const metCount = requirements.filter((r) => r.met).length;
  let strength: "weak" | "medium" | "strong" = "weak";
  if (metCount === 4) strength = "strong";
  else if (metCount >= 2) strength = "medium";
  return { requirements, strength, metCount };
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { requirements, strength } = getPasswordStrength(password);
  const barColor =
    strength === "strong" ? "bg-[#7eb88a]" : strength === "medium" ? "bg-yellow-500" : "bg-red-400";
  const labelColor =
    strength === "strong" ? "text-[#7eb88a]" : strength === "medium" ? "text-yellow-500" : "text-red-400";
  const width = strength === "strong" ? "100%" : strength === "medium" ? "66%" : "33%";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-[#2a3a4a] overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-300", barColor)} style={{ width }} />
        </div>
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", labelColor)}>{strength}</span>
      </div>
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li key={req.label} className={cn("flex items-center gap-1.5 text-[11px] transition", req.met ? "text-[#7eb88a]" : "text-[#4a6580]")}>
            <IconCheck className={cn("transition", req.met ? "opacity-100" : "opacity-0")} />
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Password Input ─────────────────────────────────── */

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#1c2733] px-4 py-3">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a6580" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent text-sm text-white placeholder-[#4a6580] outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-[#4a6580] hover:text-[#6b8299] transition"
        tabIndex={-1}
      >
        <IconEye open={show} />
      </button>
    </div>
  );
}

/* ── Step 1: Email / Login / Signup ─────────────────── */

function EmailStep() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const signUp = useAuthStore((s) => s.signUp);
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const loading = useAuthStore((s) => s.loading);
  const otpError = useAuthStore((s) => s.otpError);
  const setAuthStep = useAuthStore((s) => s.setAuthStep);
  const setAuthMode = useAuthStore((s) => s.setAuthMode);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const { strength } = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail) { setLocalError("Enter a valid email address"); return; }
    if (!password) { setLocalError("Please enter your password"); return; }
    setLocalError("");
    await signInWithPassword(email, password);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail) { setLocalError("Enter a valid email address"); return; }
    if (strength !== "strong") { setLocalError("Please meet all password requirements"); return; }
    if (!passwordsMatch) { setLocalError("Passwords do not match"); return; }
    setLocalError("");
    await signUp(email, password);
  };

  const handleOtpLogin = async () => {
    if (!isValidEmail) { setLocalError("Enter a valid email address"); return; }
    setLocalError("");
    setAuthMode("login-otp");
    await sendOtp(email);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        <IconWave size={56} />
        <h1 className="text-2xl font-semibold text-white">Wave 2.0</h1>
        <p className="text-sm text-[#6b8299]">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>
      </div>

      <div className="flex rounded-xl bg-[#1c2733] p-1">
        <button
          type="button"
          onClick={() => { setMode("login"); setLocalError(""); }}
          className={cn(
            "flex-1 rounded-lg py-2 text-xs font-semibold transition",
            mode === "login" ? "bg-[#2a3a4a] text-white" : "text-[#4a6580] hover:text-[#6b8299]"
          )}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setLocalError(""); }}
          className={cn(
            "flex-1 rounded-lg py-2 text-xs font-semibold transition",
            mode === "signup" ? "bg-[#2a3a4a] text-white" : "text-[#4a6580] hover:text-[#6b8299]"
          )}
        >
          Sign Up
        </button>
      </div>

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
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

          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Password"
          />

          {(localError || otpError) && (
            <p className="text-xs text-red-400 text-center" role="alert">{localError || otpError}</p>
          )}

          <button
            type="submit"
            disabled={!isValidEmail || !password || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7eb88a] py-3 text-sm font-semibold text-[#0e1621] transition hover:bg-[#6da879] disabled:opacity-40"
          >
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
              </svg>
            ) : "Log In"}
          </button>

          <div className="flex flex-col gap-2 text-center">
            <button
              type="button"
              onClick={handleOtpLogin}
              disabled={loading}
              className="text-xs text-[#7eb88a] hover:underline disabled:opacity-40"
            >
              Log in with code instead
            </button>
            <button
              type="button"
              onClick={() => { setAuthStep("forgot-password"); setLocalError(""); }}
              className="text-xs text-[#4a6580] hover:text-[#6b8299] transition"
            >
              Forgot Password?
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
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

          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Create a password"
          />

          <PasswordStrength password={password} />

          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
          />

          {(localError || otpError) && (
            <p className="text-xs text-red-400 text-center" role="alert">{localError || otpError}</p>
          )}

          <button
            type="submit"
            disabled={!isValidEmail || !password || strength !== "strong" || !passwordsMatch || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7eb88a] py-3 text-sm font-semibold text-[#0e1621] transition hover:bg-[#6da879] disabled:opacity-40"
          >
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
              </svg>
            ) : "Sign Up"}
          </button>

          <p className="text-center text-xs text-[#4a6580]">
            We'll send a verification code to confirm your email
          </p>
        </form>
      )}
    </div>
  );
}

/* ── Step 2: OTP ────────────────────────────────────── */

function OtpStep() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const email = useAuthStore((s) => s.email);
  const authMode = useAuthStore((s) => s.authMode);
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
        <h1 className="text-xl font-semibold text-white">
          {authMode === "signup" ? "Verify your email" : "Check your email"}
        </h1>
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

/* ── Step: Forgot Password ──────────────────────────── */

function ForgotPasswordStep() {
  const storeEmail = useAuthStore((s) => s.email);
  const [email, setEmail] = useState(storeEmail);
  const [localError, setLocalError] = useState("");
  const [sent, setSent] = useState(false);

  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const loading = useAuthStore((s) => s.loading);
  const otpError = useAuthStore((s) => s.otpError);
  const setAuthStep = useAuthStore((s) => s.setAuthStep);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) { setLocalError("Enter a valid email address"); return; }
    setLocalError("");
    await sendPasswordReset(email);
    if (!useAuthStore.getState().otpError) {
      setSent(true);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1c2733]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Reset Password</h1>
        <p className="text-sm text-[#6b8299] text-center">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {sent ? (
        <div className="space-y-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1b3a2d] mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="text-sm text-[#7eb88a]">Reset link sent!</p>
          <p className="text-xs text-[#6b8299]">
            Check your email for a link to reset your password.
          </p>
        </div>
      ) : (
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

          <button
            type="submit"
            disabled={!isValid || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7eb88a] py-3 text-sm font-semibold text-[#0e1621] transition hover:bg-[#6da879] disabled:opacity-40"
          >
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
              </svg>
            ) : "Send Reset Link"}
          </button>
        </form>
      )}

      <button
        onClick={() => setAuthStep("email")}
        className="flex w-full items-center justify-center gap-2 text-xs text-[#4a6580] transition hover:text-[#6b8299]"
      >
        ← Back to login
      </button>
    </div>
  );
}

/* ── Step: Reset Password ───────────────────────────── */

function ResetPasswordStep() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const updatePassword = useAuthStore((s) => s.updatePassword);
  const loading = useAuthStore((s) => s.loading);
  const otpError = useAuthStore((s) => s.otpError);

  const { strength } = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strength !== "strong") { setLocalError("Please meet all password requirements"); return; }
    if (!passwordsMatch) { setLocalError("Passwords do not match"); return; }
    setLocalError("");
    await updatePassword(password);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1c2733]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">New Password</h1>
        <p className="text-sm text-[#6b8299] text-center">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="New password"
          autoFocus
        />

        <PasswordStrength password={password} />

        <PasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm new password"
        />

        {(localError || otpError) && (
          <p className="text-xs text-red-400 text-center" role="alert">{localError || otpError}</p>
        )}

        <button
          type="submit"
          disabled={!password || strength !== "strong" || !passwordsMatch || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7eb88a] py-3 text-sm font-semibold text-[#0e1621] transition hover:bg-[#6da879] disabled:opacity-40"
        >
          {loading ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
            </svg>
          ) : "Update Password"}
        </button>
      </form>
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
