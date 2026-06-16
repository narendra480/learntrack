import { useState, useEffect } from "react";

// ─── API CONFIG ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:4000/api"; // Your backend URL

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const api = async (path, method = "GET", body = null) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error((await res.json()).message || "API error");
  return res.json();
};

const STATUS_COLORS = {
  completed: "#22c55e",
  "in-progress": "#f59e0b",
  "not-started": "#94a3b8",
};
const STATUS_LABELS = {
  completed: "✅ Completed",
  "in-progress": "⏳ In Progress",
  "not-started": "🔲 Not Started",
};

// ─── FONTS & GLOBAL STYLE ─────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f0f7ff;
      --surface: #ffffff;
      --surface2: #e8f2ff;
      --border: #c8dff7;
      --accent: #2563eb;
      --accent-light: #dbeafe;
      --accent2: #3b82f6;
      --green: #16a34a;
      --green-light: #dcfce7;
      --amber: #d97706;
      --amber-light: #fef3c7;
      --red: #dc2626;
      --red-light: #fee2e2;
      --text: #1e3a5f;
      --muted: #64748b;
      --radius: 14px;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }

    h1,h2,h3,h4 { font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text); }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--surface2); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    input, select, textarea {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--surface);
      border: 1.5px solid var(--border);
      color: var(--text);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      outline: none;
      width: 100%;
      transition: border-color .2s, box-shadow .2s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }
    input::placeholder { color: #a0b4c8; }

    button {
      font-family: 'Plus Jakarta Sans', sans-serif;
      cursor: pointer;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      transition: all .18s;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,.15); }
    button:active { transform: translateY(0); box-shadow: none; }

    .btn-primary {
      background: var(--accent);
      color: #ffffff;
      padding: 10px 22px;
      font-size: 14px;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-danger {
      background: var(--red-light);
      color: var(--red);
      border: 1.5px solid #fca5a5;
      padding: 8px 16px;
      font-size: 13px;
    }
    .btn-danger:hover { background: #fecaca; }
    .btn-ghost {
      background: var(--surface);
      color: var(--muted);
      border: 1.5px solid var(--border);
      padding: 8px 16px;
      font-size: 13px;
    }
    .btn-ghost:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }

    .card {
      background: var(--surface);
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: 0 1px 4px rgba(37,99,235,.06);
    }

    .label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: 6px;
      display: block;
    }

    .form-group { margin-bottom: 18px; }

    .tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-up { animation: fadeUp .4s ease both; }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spinner {
      display: inline-block;
      width: 18px; height: 18px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }

    table { width: 100%; border-collapse: collapse; }
    th {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .07em;
      color: var(--muted);
      font-weight: 700;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1.5px solid var(--border);
      background: var(--surface2);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #e8f2ff;
      font-size: 14px;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f0f7ff; }
  `}</style>
);

// ─── FORGOT PASSWORD PAGE ─────────────────────────────────────────────────────
function ForgotPasswordPage({ onBack }) {
  const [step, setStep] = useState("request"); // request | verify | reset | done
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetToken, setResetToken] = useState("");

  const handleRequest = async () => {
    if (!email.trim()) return setError("Please enter your email");
    setError(""); setLoading(true);
    try {
      await api("/auth/forgot-password", "POST", { email });
      setStep("verify");
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!code.trim()) return setError("Please enter the code");
    setError(""); setLoading(true);
    try {
      const data = await api("/auth/verify-reset-code", "POST", { email, code });
      setResetToken(data.resetToken);
      setStep("reset");
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!newPassword) return setError("Please enter a new password");
    if (newPassword !== confirmPassword) return setError("Passwords do not match");
    if (newPassword.length < 6) return setError("Password must be at least 6 characters");
    setError(""); setLoading(true);
    try {
      await api("/auth/reset-password", "POST", { resetToken, newPassword });
      setStep("done");
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const bgStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 40%, #f0f7ff 100%)" };
  const cardStyle = { boxShadow: "0 8px 32px rgba(37,99,235,.1)", border: "1.5px solid #c8dff7" };

  return (
    <div style={bgStyle}>
      <div className="fade-up" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#2563eb,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 14px", boxShadow: "0 8px 24px rgba(37,99,235,.25)" }}>📚</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1e3a5f" }}>LearnTrack</h1>
        </div>

        <div className="card" style={cardStyle}>
          {step === "request" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Forgot Password?</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 22 }}>Enter your email and we'll send a reset code</p>
              {error && <div style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>⚠ {error}</div>}
              <div className="form-group">
                <label className="label">Email Address</label>
                <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRequest()} />
              </div>
              <button className="btn-primary" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }} onClick={handleRequest} disabled={loading}>
                {loading ? <><span className="spinner" /> Sending…</> : "Send Reset Code →"}
              </button>
            </>
          )}

          {step === "verify" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Check Your Email</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 22 }}>We sent a 6-digit code to <strong style={{ color: "var(--text)" }}>{email}</strong></p>
              {error && <div style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>⚠ {error}</div>}
              <div className="form-group">
                <label className="label">6-Digit Code</label>
                <input placeholder="123456" value={code} onChange={e => setCode(e.target.value)} maxLength={6} style={{ letterSpacing: "0.3em", fontSize: 20, textAlign: "center" }} onKeyDown={e => e.key === "Enter" && handleVerify()} />
              </div>
              <button className="btn-primary" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }} onClick={handleVerify} disabled={loading}>
                {loading ? <><span className="spinner" /> Verifying…</> : "Verify Code →"}
              </button>
            </>
          )}

          {step === "reset" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Set New Password</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 22 }}>Choose a strong new password</p>
              {error && <div style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>⚠ {error}</div>}
              <div className="form-group">
                <label className="label">New Password</label>
                <input type="password" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Confirm Password</label>
                <input type="password" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReset()} />
              </div>
              <button className="btn-primary" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }} onClick={handleReset} disabled={loading}>
                {loading ? <><span className="spinner" /> Updating…</> : "Update Password →"}
              </button>
            </>
          )}

          {step === "done" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Password Updated!</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>You can now sign in with your new password</p>
              <button className="btn-primary" style={{ padding: "12px 32px", fontSize: 15, borderRadius: 12 }} onClick={onBack}>Back to Sign In →</button>
            </div>
          )}

          {step !== "done" && (
            <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, marginTop: 18, display: "block", width: "100%", textAlign: "center", cursor: "pointer", boxShadow: "none" }}>
              ← Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ForgotUsernamePage({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRequest = async () => {
    if (!email.trim()) return setError("Please enter your email");
    setError(""); setSuccess(""); setLoading(true);
    try {
      await api("/auth/forgot-username", "POST", { email });
      setSuccess("If your email exists, we've sent your username to it.");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 40%, #f0f7ff 100%)" }}>
      <div className="fade-up" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#2563eb,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 14px", boxShadow: "0 8px 24px rgba(37,99,235,.25)" }}>📚</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1e3a5f" }}>LearnTrack</h1>
        </div>

        <div className="card" style={{ boxShadow: "0 8px 32px rgba(37,99,235,.1)", border: "1.5px solid #c8dff7" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Forgot Username?</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 22 }}>Enter the email address you used to sign up and we'll send your username.</p>
          {error && <div style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>⚠ {error}</div>}
          {success && <div style={{ background: "#dcfce7", border: "1.5px solid #86efac", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>✅ {success}</div>}
          <div className="form-group">
            <label className="label">Email Address</label>
            <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRequest()} />
          </div>
          <button className="btn-primary" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }} onClick={handleRequest} disabled={loading}>
            {loading ? <><span className="spinner" /> Sending…</> : "Send Username →"}
          </button>

          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, marginTop: 18, display: "block", width: "100%", textAlign: "center", cursor: "pointer", boxShadow: "none" }}>
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const payload = tab === "login"
        ? { username: form.username, password: form.password }
        : { username: form.username, email: form.email, password: form.password };
      const data = await api(endpoint, "POST", payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      console.log("✅ Auth success:", data.user.username);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
      console.error("❌ Auth failed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  // Check for Google OAuth redirect token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userParam = params.get("user");
    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        window.history.replaceState({}, "", window.location.pathname);
        onLogin(user);
      } catch { }
    }
  }, []);

  if (showForgot === "password") return <ForgotPasswordPage onBack={() => setShowForgot(null)} />;
  if (showForgot === "username") return <ForgotUsernamePage onBack={() => setShowForgot(null)} />;

  const dividerStyle = { display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "var(--muted)", fontSize: 13 };
  const lineStyle = { flex: 1, height: 1, background: "var(--border)" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 40%, #f0f7ff 100%)" }}>
      <div className="fade-up" style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#2563eb,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 14px", boxShadow: "0 8px 24px rgba(37,99,235,.25)" }}>📚</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#1e3a5f", letterSpacing: "-.03em" }}>LearnTrack</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Your daily learning companion</p>
        </div>

        <div className="card" style={{ boxShadow: "0 8px 32px rgba(37,99,235,.1)", border: "1.5px solid #c8dff7" }}>
          {/* Google Sign In Button */}
          <button onClick={handleGoogleLogin} style={{
            width: "100%", padding: "12px", borderRadius: 12, marginBottom: 6,
            background: "#ffffff", border: "1.5px solid #dadce0", color: "#3c4043",
            fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,.08)"
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={dividerStyle}>
            <div style={lineStyle} />
            <span>or sign in with username</span>
            <div style={lineStyle} />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "#f0f7ff", padding: 4, borderRadius: 12 }}>
            {["login", "register"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "9px", borderRadius: 9,
                background: tab === t ? "#2563eb" : "transparent",
                color: tab === t ? "#ffffff" : "var(--muted)",
                fontSize: 14, fontWeight: 700, border: "none",
                boxShadow: tab === t ? "0 2px 8px rgba(37,99,235,.3)" : "none",
                transition: "all .2s"
              }}>{t === "login" ? "Sign In" : "Register"}</button>
            ))}
          </div>

          {error && (
            <div style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#dc2626" }}>
              ⚠ {error}
            </div>
          )}

          <div className="form-group">
            <label className="label">Username</label>
            <input placeholder="your_username" value={form.username} onChange={set("username")} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>

          {tab === "register" && (
            <div className="form-group">
              <label className="label">Email</label>
              <input type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="label">Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={set("password")} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>

          {tab === "login" && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 18 }}>
              <button onClick={() => setShowForgot("password")} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "none", padding: 0 }}>
                Forgot password?
              </button>
              <button onClick={() => setShowForgot("username")} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "none", padding: 0 }}>
                Forgot username?
              </button>
            </div>
          )}

          <button className="btn-primary" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12, boxShadow: "0 4px 16px rgba(37,99,235,.3)" }} onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" /> Authenticating…</> : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>

          <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
            Demo: <strong style={{ color: "var(--text)" }}>admin / password123</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
function ProfilePage({ user, onProfileSave }) {
  const [profile, setProfile] = useState({
    name: "", profession: "", bio: "",
    interestedCourses: "", completedCourses: "", email: user?.email || ""
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/profile");
        if (data) setProfile(data);
      } catch { /* no profile yet */ }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    try {
      await api("/profile", "PUT", profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onProfileSave(profile);
      console.log("✅ Profile saved:", profile.name);
    } catch (err) { alert(err.message); }
  };

  const set = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}><span className="spinner" /> Loading profile…</div>;

  return (
    <div className="fade-up" style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Your Profile</h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Set up your learning identity</p>
      </div>

      {/* Avatar block */}
      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, color: "#fff", fontWeight: 800, boxShadow: "0 4px 16px rgba(37,99,235,.25)" }}>
          {profile.name ? profile.name[0].toUpperCase() : "👤"}
        </div>
        <div>
          <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 18 }}>{profile.name || "Your Name"}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{profile.profession || "Profession"}</div>
          <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 2 }}>@{user?.username}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input placeholder="e.g. Arun Kumar" value={profile.name} onChange={set("name")} />
          </div>
          <div className="form-group">
            <label className="label">Profession</label>
            <input placeholder="e.g. Software Engineer" value={profile.profession} onChange={set("profession")} />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Email (for reminders)</label>
          <input type="email" placeholder="you@email.com" value={profile.email} onChange={set("email")} />
        </div>

        <div className="form-group">
          <label className="label">Bio</label>
          <textarea placeholder="Tell us about your learning goals…" value={profile.bio} onChange={set("bio")} rows={3} style={{ resize: "vertical" }} />
        </div>

        <div className="form-group">
          <label className="label">Interested Courses (comma separated)</label>
          <input placeholder="e.g. Python, Machine Learning, SQL" value={profile.interestedCourses} onChange={set("interestedCourses")} />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Completed Courses</label>
          <input placeholder="e.g. HTML, CSS, JavaScript Basics" value={profile.completedCourses} onChange={set("completedCourses")} />
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button className="btn-primary" onClick={handleSave}>
            {saved ? "✓ Saved!" : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function DashboardPage({ user, profile, onSelectCourse }) {
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ completed: 0, inProgress: 0, notStarted: 0 });

  const refreshCourses = async () => {
    try {
      const data = await api("/courses");
      setCourses(data);
      const completed = data.filter(c => c.status === "completed").length;
      const inProgress = data.filter(c => c.status === "in-progress").length;
      const notStarted = data.filter(c => c.status === "not-started").length;
      setStats({ completed, inProgress, notStarted });
    } catch { }
  };

  useEffect(() => {
    refreshCourses();
  }, []);

  const deleteCourse = async (id) => {
    if (!confirm("Delete this course and its entries?")) return;
    try {
      await api(`/courses/${id}`, "DELETE");
      setCourses(courses.filter(c => c.id !== id));
      refreshCourses();
    } catch (err) {
      alert(err.message);
    }
  };

  const interested = profile?.interestedCourses?.split(",").map(s => s.trim()).filter(Boolean) || [];

  return (
    <div className="fade-up" style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Welcome back, {profile?.name || user?.username}! 👋</h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Here's your learning overview</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Completed", value: stats.completed, color: "#16a34a", bg: "#dcfce7", border: "#86efac", icon: "✅" },
          { label: "In Progress", value: stats.inProgress, color: "#d97706", bg: "#fef3c7", border: "#fcd34d", icon: "⏳" },
          { label: "Not Started", value: stats.notStarted, color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1", icon: "🔲" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", borderColor: s.border, background: s.bg }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ color: s.color, fontSize: 13, fontWeight: 600, opacity: .8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Select plan section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📋 Select a Course Plan</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 18 }}>Type a course name to start tracking your daily progress</p>
        <CoursePicker onSelect={onSelectCourse} />
      </div>

      {/* Interested courses */}
      {interested.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🎯 Your Interested Courses</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {interested.map(c => (
              <button key={c} className="btn-ghost" onClick={() => onSelectCourse(c)}
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                {c} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active courses */}
      {courses.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📚 Active Courses</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {courses.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface2)", borderRadius: 10, border: "1px solid var(--border)", transition: "border-color .2s" }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onSelectCourse(c.name)}
                  onMouseEnter={e => e.currentTarget.parentElement.style.borderColor = "var(--accent)"}
                  onMouseLeave={e => e.currentTarget.parentElement.style.borderColor = "var(--border)"}
                >
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Started {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="tag" style={{ background: STATUS_COLORS[c.status] + "22", color: STATUS_COLORS[c.status] }}>
                    {STATUS_LABELS[c.status]}
                  </span>
                  <button className="btn-danger" style={{ padding: "6px 10px", fontSize: 12, borderRadius: 10 }} onClick={(e) => { e.stopPropagation(); deleteCourse(c.id); }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COURSE PICKER WIDGET ─────────────────────────────────────────────────────
function CoursePicker({ onSelect }) {
  const [val, setVal] = useState("");
  const suggestions = ["Python", "JavaScript", "SQL", "Machine Learning", "React", "Data Science", "Node.js", "Java", "C++", "AWS"];

  return (
    <div>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          placeholder="e.g. Python, Machine Learning, SQL…"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && val.trim() && onSelect(val.trim())}
          style={{ flex: 1 }}
        />
        <button className="btn-primary" onClick={() => val.trim() && onSelect(val.trim())} disabled={!val.trim()}>
          Start Tracking →
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => { setVal(s); onSelect(s); }}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer" }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TRACKER PAGE ─────────────────────────────────────────────────────────────
function TrackerPage({ selectedCourse, onChangeCourse }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ date: new Date().toISOString().split("T")[0], topic: "", status: "not-started", notes: "" });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if (!selectedCourse) return;
    loadCourse();
  }, [selectedCourse]);

  const loadCourse = async () => {
    setLoading(true);
    try {
      // Create or get course
      const course = await api("/courses/find-or-create", "POST", { name: selectedCourse });
      setCourseId(course.id);
      const data = await api(`/courses/${course.id}/entries`);
      setEntries(data);
      console.log(`📊 Loaded ${data.length} entries for course: ${selectedCourse}`);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const addEntry = async () => {
    if (!newRow.topic.trim()) return;
    try {
      const entry = await api(`/courses/${courseId}/entries`, "POST", newRow);
      setEntries([...entries, entry]);
      setNewRow({ date: new Date().toISOString().split("T")[0], topic: "", status: "not-started", notes: "" });
      setAdding(false);
    } catch (err) { alert(err.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api(`/entries/${id}`, "PATCH", { status });
      setEntries(entries.map(e => e.id === id ? { ...e, status } : e));
    } catch (err) { alert(err.message); }
  };

  const deleteEntry = async (id) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await api(`/entries/${id}`, "DELETE");
      setEntries(entries.filter(e => e.id !== id));
    } catch (err) { alert(err.message); }
  };

  const getAISuggestions = async () => {
    setLoadingAI(true);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.GROQ_API_KEY || "YOUR_GROQ_KEY"}`
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{
            role: "user",
            content: `Give me a 7-day study plan for ${selectedCourse}. Return as JSON array: [{day:1, topic:"...", duration:"..."}]. No markdown.`
          }],
          max_tokens: 600
        })
      });
      const data = await res.json();
      const text = data.choices[0].message.content;
      const plan = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAiSuggestions(plan);
    } catch (err) { console.error("AI error:", err); }
    setLoadingAI(false);
  };

  const completedCount = entries.filter(e => e.status === "completed").length;
  const progress = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0;

  if (!selectedCourse) return (
    <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <h3 style={{ fontFamily: "Syne", marginBottom: 8 }}>No course selected</h3>
      <p>Go to Dashboard and pick a course to start tracking</p>
      <button className="btn-primary" onClick={onChangeCourse} style={{ marginTop: 20 }}>Go to Dashboard</button>
    </div>
  );

  return (
    <div className="fade-up" style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>📘 {selectedCourse}</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>{entries.length} entries · {completedCount} completed</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={getAISuggestions} disabled={loadingAI}>
            {loadingAI ? <><span className="spinner" /> Getting AI plan…</> : "🤖 AI Study Plan"}
          </button>
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add Entry</button>
        </div>
      </div>

      {/* Progress bar */}
      {entries.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: "var(--muted)" }}>Overall Progress</span>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{progress}%</span>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#58a6ff,#22c55e)", borderRadius: 99, transition: "width .5s" }} />
          </div>
        </div>
      )}

      {/* Add entry form */}
      {adding && (
        <div className="card" style={{ marginBottom: 20, border: "1px solid var(--accent)" }}>
          <h4 style={{ marginBottom: 16, fontSize: 15 }}>➕ New Entry</h4>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label">Date</label>
              <input type="date" value={newRow.date} onChange={e => setNewRow({ ...newRow, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Topic</label>
              <input placeholder="e.g. Variables & Data Types" value={newRow.topic} onChange={e => setNewRow({ ...newRow, topic: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select value={newRow.status} onChange={e => setNewRow({ ...newRow, status: e.target.value })}>
                <option value="not-started">🔲 Not Started</option>
                <option value="in-progress">⏳ In Progress</option>
                <option value="completed">✅ Completed</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="label">Notes (optional)</label>
            <input placeholder="Any notes or resources…" value={newRow.notes} onChange={e => setNewRow({ ...newRow, notes: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={addEntry}>Save Entry</button>
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* AI suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: "1px solid #f59e0b44" }}>
          <h4 style={{ marginBottom: 14, fontSize: 15, color: "var(--amber)" }}>🤖 AI-Generated 7-Day Study Plan</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aiSuggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", background: "var(--surface2)", borderRadius: 8 }}>
                <span style={{ background: "var(--accent)", color: "#0d1117", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>D{s.day}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{s.topic}</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{s.duration}</span>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => { setNewRow({ date: new Date().toISOString().split("T")[0], topic: s.topic, status: "not-started", notes: "" }); setAdding(true); }}>
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}><span className="spinner" /> Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <p>No entries yet. Click <strong>+ Add Entry</strong> to start tracking!</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td style={{ fontWeight: 500 }}>{e.topic}</td>
                  <td>
                    <select
                      value={e.status}
                      onChange={ev => updateStatus(e.id, ev.target.value)}
                      style={{ width: "auto", padding: "4px 10px", background: STATUS_COLORS[e.status] + "22", color: STATUS_COLORS[e.status], border: `1px solid ${STATUS_COLORS[e.status]}66`, borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                    >
                      <option value="not-started">🔲 Not Started</option>
                      <option value="in-progress">⏳ In Progress</option>
                      <option value="completed">✅ Completed</option>
                    </select>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{e.notes || "—"}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => deleteEntry(e.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ user, onLogout }) {
  const [groqKey, setGroqKey] = useState(window.GROQ_API_KEY || "");
  const [testStatus, setTestStatus] = useState("");

  const saveKey = () => {
    window.GROQ_API_KEY = groqKey;
    setTestStatus("✅ Groq key saved for this session!");
    setTimeout(() => setTestStatus(""), 3000);
  };

  const testEmail = async () => {
    try {
      await api("/email/test", "POST");
      setTestStatus("✅ Test email sent! Check your inbox.");
    } catch (err) { setTestStatus("❌ " + err.message); }
    setTimeout(() => setTestStatus(""), 4000);
  };

  return (
    <div className="fade-up" style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 28 }}>⚙️ Settings</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🤖 Groq AI API Key</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
          Get your free key at <a href="https://console.groq.com" target="_blank" style={{ color: "var(--accent)" }}>console.groq.com</a> · Used for AI study plans
        </p>
        <div className="form-group">
          <label className="label">API Key</label>
          <input type="password" placeholder="gsk_…" value={groqKey} onChange={e => setGroqKey(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={saveKey}>Save Key</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📧 Email Reminders</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
          Reminders are sent daily at <strong style={{ color: "var(--text)" }}>10:00 AM</strong>, <strong style={{ color: "var(--text)" }}>3:00 PM</strong>, and <strong style={{ color: "var(--text)" }}>9:00 PM</strong> IST
        </p>
        <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "var(--muted)", border: "1px solid var(--border)" }}>
          <strong style={{ color: "var(--text)" }}>Email template:</strong><br />
          "📚 Don't forget to update your learning progress today!<br />
          If you've already completed today's task, please ignore this reminder.<br />
          Update your progress here: [link]"
        </div>
        <button className="btn-ghost" onClick={testEmail}>Send Test Email</button>
      </div>

      {testStatus && (
        <div style={{ padding: "12px 16px", background: "var(--surface2)", borderRadius: 10, marginBottom: 20, fontSize: 14, border: "1px solid var(--border)" }}>
          {testStatus}
        </div>
      )}

      <div className="card" style={{ borderColor: "#f8717144" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Account</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Signed in as <strong style={{ color: "var(--text)" }}>@{user?.username}</strong></p>
        <button className="btn-danger" onClick={onLogout}>Sign Out</button>
      </div>
    </div>
  );
}

// ─── LAYOUT / NAV ─────────────────────────────────────────────────────────────
function Nav({ page, onPage, selectedCourse, user }) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "tracker", label: selectedCourse ? `📘 ${selectedCourse}` : "Tracker", icon: "" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <nav style={{ background: "#ffffff", borderBottom: "1.5px solid #c8dff7", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(37,99,235,.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 0" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#2563eb,#60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📚</div>
        <span style={{ fontFamily: "Plus Jakarta Sans", fontWeight: 800, fontSize: 17, color: "#1e3a5f", letterSpacing: "-.02em" }}>LearnTrack</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => onPage(t.id)} style={{
            background: page === t.id ? "#dbeafe" : "transparent",
            color: page === t.id ? "#2563eb" : "#64748b",
            padding: "8px 16px", borderRadius: 10, fontSize: 13, fontFamily: "Plus Jakarta Sans",
            border: page === t.id ? "1.5px solid #93c5fd" : "1.5px solid transparent",
            fontWeight: page === t.id ? 700 : 500,
            transition: "all .18s"
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 20, padding: "5px 14px", fontSize: 13, color: "#2563eb", fontWeight: 600 }}>@{user?.username}</div>
    </nav>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [page, setPage] = useState("dashboard");
  const [profile, setProfile] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await api("/profile");
        setProfile(data);
      } catch {
        setProfile(null);
      }
    })();
  }, [user]);

  const handleLogin = (u) => { setUser(u); setPage("profile"); };
  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); };
  const handleSelectCourse = (name) => { setSelectedCourse(name); setPage("tracker"); };

  if (!user) return <><GlobalStyle /><LoginPage onLogin={handleLogin} /></>;

  return (
    <>
      <GlobalStyle />
      <Nav page={page} onPage={setPage} selectedCourse={selectedCourse} user={user} />
      <main>
        {page === "dashboard" && <DashboardPage user={user} profile={profile} onSelectCourse={handleSelectCourse} />}
        {page === "tracker" && <TrackerPage selectedCourse={selectedCourse} onChangeCourse={() => setPage("dashboard")} />}
        {page === "profile" && <ProfilePage user={user} onProfileSave={setProfile} />}
        {page === "settings" && <SettingsPage user={user} onLogout={handleLogout} />}
      </main>
    </>
  );
}
