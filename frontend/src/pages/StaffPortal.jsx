import { useState } from "react";
import {
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  TreePine,
  ArrowLeft,
} from "lucide-react";
import DashboardPage from "./DashboardPage.jsx";

const PASSCODE = "evolve2026";

// Staff context: who is logged in
const STAFF_OPTIONS = [
  { id: 1, name: "Bradley",  role: "CEO",                                       initials: "BD" },
  { id: 2, name: "Cameron",  role: "Support worker",                             initials: "CM" },
  { id: 3, name: "Teyarnee", role: "Suicide prevention peer worker",             initials: "TY" },
  { id: 4, name: "Jane",     role: "Community engagement & fundraising",         initials: "JN" },
  { id: 5, name: "Kara",     role: "Psychologist",                               initials: "KT" },
];

export default function StaffPortal({ onBack }) {
  const [authed, setAuthed]       = useState(false);
  const [passcode, setPasscode]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState("");
  const [activeStaff, setActiveStaff] = useState(STAFF_OPTIONS[0]);

  function tryLogin(e) {
    e.preventDefault();
    if (passcode === PASSCODE) {
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect passcode. Hint: evolve + year");
      setPasscode("");
    }
  }

  if (!authed) {
    return (
      <div className="staff-login-screen">
        <button className="back-button" onClick={onBack} style={{ position: "absolute", top: "1.5rem", left: "1.5rem" }}>
          <ArrowLeft size={18} />
        </button>

        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark">
              <TreePine size={22} />
            </div>
            <div>
              <p className="eyebrow">PathFinder</p>
              <h2 style={{ fontSize: "1.4rem" }}>Staff access</h2>
            </div>
          </div>

          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Enter the Evolve Hub passcode to access the staff dashboard.
          </p>

          <form onSubmit={tryLogin} className="login-form">
            {/* Staff selector */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontWeight: 600, fontSize: "0.88rem" }}>
              Logging in as
              <div className="staff-chips">
                {STAFF_OPTIONS.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`staff-chip${activeStaff.id === s.id ? " selected" : ""}`}
                    onClick={() => setActiveStaff(s)}
                  >
                    <span className="staff-initials">{s.initials}</span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontWeight: 600, fontSize: "0.88rem" }}>
              Passcode
              <div className="passcode-input-row">
                <Lock size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Hub passcode"
                  autoComplete="current-password"
                  style={{
                    flex: 1, border: "none", background: "transparent",
                    outline: "none", fontSize: "1rem", color: "var(--charcoal)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{ color: "var(--muted)", padding: "0.2rem" }}
                  aria-label={showPw ? "Hide passcode" : "Show passcode"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p style={{ color: "var(--coral)", fontSize: "0.84rem", margin: 0 }}>{error}</p>
            )}

            <button type="submit" className="primary-button" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
              <BarChart3 size={17} />
              Access dashboard
            </button>
          </form>

          <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", marginTop: "1rem" }}>
            LMNSPN staff only · 54 Ridley Street, Charlestown
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-portal">
      {/* Staff top bar */}
      <header className="staff-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <TreePine size={20} />
          </div>
          <div className="brand-name">
            <p className="eyebrow">Staff dashboard</p>
            <h1 style={{ fontSize: "1.2rem" }}>PathFinder</h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Active staff pill */}
          <div className="active-staff-pill">
            <span className="staff-initials small">{activeStaff.initials}</span>
            <div>
              <strong>{activeStaff.name}</strong>
              <small>{activeStaff.role}</small>
            </div>
          </div>

          <button
            className="quiet-button"
            onClick={() => { setAuthed(false); setPasscode(""); }}
            title="Sign out"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <main style={{ padding: "clamp(1rem, 2.5vw, 1.75rem) clamp(1rem, 3vw, 2.5rem)" }}>
        <DashboardPage activeStaff={activeStaff} />
      </main>
    </div>
  );
}
