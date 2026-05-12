import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Lightbulb,
  Loader2,
  MapPin,
  Phone,
  Save,
  Tag,
  User,
  X,
  Zap,
} from "lucide-react";
import { api, riskLabel } from "../../lib/api.js";

const STATUS_OPTIONS = [
  { value: "new",        label: "New" },
  { value: "assigned",   label: "Assigned" },
  { value: "contacted",  label: "Contacted" },
  { value: "in_program", label: "In program" },
  { value: "follow_up",  label: "Follow-up" },
];

const THEME_LABELS = {
  suicide_risk:      "Suicide risk",
  self_harm:         "Self-harm",
  trauma:            "Trauma / PTSD",
  grief_loss:        "Grief & loss",
  relationship:      "Relationship",
  substance_use:     "Substance use",
  work_stress:       "Work / employment",
  anxiety:           "Anxiety / panic",
  depression:        "Depression",
  isolation:         "Isolation",
  youth_challenges:  "Youth / school",
  financial_stress:  "Financial stress",
  identity:          "Identity",
  carer_burden:      "Carer burden",
  veteran_first_resp:"Veteran / first responder",
  cultural_factors:  "Cultural factors",
};

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ReferralDrawer({ referral, staff, initialTab = "detail", onClose, onUpdated }) {
  const [insights, setInsights]     = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [tab, setTab]               = useState(initialTab);   // "detail" | "insights"
  const [form, setForm]             = useState({
    status:       referral.status,
    assigned_to:  referral.assigned_to ?? "",
    notes:        referral.notes ?? "",
    outcome_notes: referral.outcome_notes ?? "",
  });
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    setTab(initialTab);
    setInsights(null);
    setForm({
      status:       referral.status,
      assigned_to:  referral.assigned_to ?? "",
      notes:        referral.notes ?? "",
      outcome_notes: referral.outcome_notes ?? "",
    });
  }, [referral, initialTab]);

  // Load insights when insights tab selected
  useEffect(() => {
    if (tab !== "insights" || insights) return;
    setLoadingInsights(true);
    api.caseInsights(referral.id)
      .then((d) => { setInsights(d); setLoadingInsights(false); })
      .catch(() => setLoadingInsights(false));
  }, [tab, referral.id, insights]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateReferral(referral.id, {
        status:       form.status,
        assigned_to:  form.assigned_to ? Number(form.assigned_to) : undefined,
        notes:        form.notes,
        outcome_notes: form.outcome_notes,
      });
      setSaved(true);
      onUpdated(updated);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const assignedStaff = staff.find((s) => s.id === (form.assigned_to || referral.assigned_to));

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer */}
      <aside className="referral-drawer" role="dialog" aria-label="Referral detail">
        {/* ── Drawer header ── */}
        <div className="drawer-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <span className={`risk-badge ${referral.risk_level}`}>
                {riskLabel[referral.risk_level]} risk
              </span>
              <span className="source-tag">#{referral.id} · {referral.source_tag}</span>
            </div>
            <h2 className="drawer-title">{referral.client_name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {referral.suburb && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  <MapPin size={13} /> {referral.suburb}
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                <Clock size={13} /> {timeAgo(referral.created_at)}
              </span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close panel">
            <X size={20} />
          </button>
        </div>

        {/* ── Tab switcher ── */}
        <div className="drawer-tabs">
          <button
            className={`drawer-tab${tab === "detail" ? " active" : ""}`}
            onClick={() => setTab("detail")}
          >
            <User size={15} /> Detail &amp; edit
          </button>
          <button
            className={`drawer-tab${tab === "insights" ? " active" : ""}`}
            onClick={() => setTab("insights")}
          >
            <BrainCircuit size={15} /> AI case insights
          </button>
        </div>

        <div className="drawer-body">
          {tab === "detail" && (
            <DetailTab
              referral={referral}
              form={form}
              setForm={setForm}
              staff={staff}
              assignedStaff={assignedStaff}
              saving={saving}
              saved={saved}
              onSave={save}
            />
          )}

          {tab === "insights" && (
            <InsightsTab
              referral={referral}
              insights={insights}
              loading={loadingInsights}
            />
          )}
        </div>
      </aside>
    </>
  );
}

// ── Detail tab ────────────────────────────────────────────────
function DetailTab({ referral, form, setForm, staff, assignedStaff, saving, saved, onSave }) {
  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="detail-tab">
      {/* Situation */}
      <div className="drawer-section">
        <h3 className="drawer-section-title">
          <Tag size={15} /> Situation
        </h3>
        <p className="drawer-situation">{referral.situation}</p>
      </div>

      {/* Referrer */}
      <div className="drawer-section">
        <h3 className="drawer-section-title">
          <User size={15} /> Referrer
        </h3>
        <div className="drawer-meta-grid">
          <span className="meta-label">Name</span>
          <span>{referral.referrer_name || "Self-referral"}</span>
          <span className="meta-label">Type</span>
          <span style={{ textTransform: "capitalize" }}>{referral.referrer_type?.replace("_", " ")}</span>
          {referral.referrer_contact && (
            <>
              <span className="meta-label">Contact</span>
              <span>
                <a href={`tel:${referral.referrer_contact}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                  <Phone size={12} /> {referral.referrer_contact}
                </a>
              </span>
            </>
          )}
        </div>
      </div>

      {/* AI assessment flags */}
      {referral.ai_assessment?.flags?.length > 0 && (
        <div className="drawer-section">
          <h3 className="drawer-section-title">
            <Zap size={15} /> Risk signals
          </h3>
          <ul className="flags-list">
            {referral.ai_assessment.flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Editable fields */}
      <div className="drawer-section">
        <h3 className="drawer-section-title">
          <Save size={15} /> Update referral
        </h3>

        <div className="drawer-form">
          <label className="drawer-label">
            Status
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="drawer-select"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="drawer-label">
            Assign to
            <select
              value={form.assigned_to}
              onChange={(e) => update("assigned_to", e.target.value)}
              className="drawer-select"
            >
              <option value="">— Unassigned —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.role}
                  {s.can_handle_high_risk ? " ✓" : ""}
                </option>
              ))}
            </select>
            {assignedStaff?.can_handle_high_risk && referral.risk_level !== "high" && (
              <small style={{ color: "var(--muted)", fontSize: "0.74rem", marginTop: "0.2rem" }}>
                ✓ This staff member can handle high-risk cases
              </small>
            )}
          </label>

          <label className="drawer-label">
            Case notes
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Add notes visible to staff only..."
              className="drawer-textarea"
            />
          </label>

          <label className="drawer-label">
            Outcome notes
            <textarea
              value={form.outcome_notes}
              onChange={(e) => update("outcome_notes", e.target.value)}
              placeholder="Document outcome for grant reporting..."
              className="drawer-textarea"
            />
          </label>

          <button
            className="primary-button"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Connected to Care links */}
      {referral.ai_assessment?.matches?.length > 0 && (
        <div className="drawer-section">
          <h3 className="drawer-section-title">
            <ExternalLink size={15} /> Matched Hub partners
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {referral.ai_assessment.matches.slice(0, 3).map((m) => (
              <a
                key={m.id}
                href="https://www.connectedtocare.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="matched-partner-link"
              >
                <div>
                  <strong>{m.name}</strong>
                  <span>{m.provider}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span className="confidence-badge">{Math.round(m.confidence * 100)}% fit</span>
                  <ChevronRight size={14} style={{ color: "var(--muted)" }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Insights tab ──────────────────────────────────────────────
function InsightsTab({ referral, insights, loading }) {
  if (loading) {
    return (
      <div className="insights-loading">
        <Loader2 size={28} className="spin" style={{ color: "var(--green-deep)" }} />
        <p>Analysing case…</p>
      </div>
    );
  }

  if (!insights) {
    return <p className="muted" style={{ padding: "1.5rem" }}>Could not load insights.</p>;
  }

  const fit = insights.clinician_fit;
  const maxFit = Math.max(
    fit.new_professional,
    fit.experienced_professional,
    fit.senior_psychologist
  );

  return (
    <div className="insights-tab">

      {/* Urgency banner */}
      <div className={`urgency-banner risk-bg-${insights.urgency.color}`}>
        <AlertTriangle size={16} />
        <div>
          <strong>{insights.urgency.label}</strong>
          <span>{insights.next_action}</span>
        </div>
      </div>

      {/* Complexity */}
      <div className="drawer-section">
        <h3 className="drawer-section-title">
          <Zap size={15} /> Case complexity
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <span className={`complexity-badge complexity-${insights.complexity_label.toLowerCase()}`}>
            {insights.complexity_label}
          </span>
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            Score {Math.round(insights.complexity_score * 100)} / 100
          </span>
        </div>
        <div className="meter">
          <div
            className="meter-fill"
            style={{
              width: `${Math.round(insights.complexity_score * 100)}%`,
              background: insights.complexity_score >= 0.65
                ? "var(--risk-high)"
                : insights.complexity_score >= 0.35
                ? "var(--risk-medium)"
                : "var(--risk-low)",
            }}
          />
        </div>
        <p className="muted" style={{ marginTop: "0.4rem" }}>{insights.notes}</p>
      </div>

      {/* Clinician fit */}
      <div className="drawer-section">
        <h3 className="drawer-section-title">
          <BrainCircuit size={15} /> Clinician alignment
        </h3>
        <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.85rem" }}>
          Percentage match to clinician experience levels, based on case complexity and themes.
        </p>
        {insights.workforce_recommendation && (
          <div className="workforce-recommendation">
            <strong>{insights.workforce_recommendation.label}</strong>
            <span>
              {Math.round(insights.workforce_recommendation.confidence * 100)}% confidence ·{" "}
              {insights.workforce_recommendation.rationale}
            </span>
          </div>
        )}

        {[
          { key: "new_professional", label: "New professional psychologist" },
          { key: "experienced_professional", label: "Experienced professional psychologist" },
          { key: "senior_psychologist", label: "Senior / specialist psychologist" },
        ].map(({ key, label }) => {
          const pct = Math.round(fit[key] * 100);
          const isRecommended = fit[key] === maxFit;
          return (
            <div key={key} className="fit-row">
              <div className="fit-row-top">
                <span className="fit-label">
                  {label}
                  {isRecommended && (
                    <span className="fit-recommended">Recommended</span>
                  )}
                </span>
                <span className="fit-pct">{pct}%</span>
              </div>
              <div className="fit-bar-track">
                <div
                  className="fit-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 70
                      ? "var(--green-deep)"
                      : pct >= 50
                      ? "var(--risk-medium)"
                      : "var(--border-mid)",
                    transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              </div>
            </div>
          );
        })}

        {insights.senior_required && (
          <div className="senior-required-notice">
            <AlertTriangle size={14} />
            Senior-required: This case involves {insights.themes
              .filter((t) => ["suicide_risk","self_harm","trauma","veteran_first_resp"].includes(t))
              .map((t) => THEME_LABELS[t] || t)
              .join(", ")}.
          </div>
        )}
      </div>

      {/* Themes */}
      {insights.themes?.length > 0 && (
        <div className="drawer-section">
          <h3 className="drawer-section-title">
            <Tag size={15} /> Detected themes
          </h3>
          <div className="theme-chips">
            {insights.themes.map((theme) => (
              <span
                key={theme}
                className={`theme-chip${["suicide_risk","self_harm","trauma"].includes(theme) ? " high" : ""}`}
              >
                {THEME_LABELS[theme] || theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Session recommendation */}
      <div className="drawer-section">
        <h3 className="drawer-section-title">
          <Calendar size={15} /> Session recommendation
        </h3>
        <div className="drawer-meta-grid">
          <span className="meta-label">Modality</span>
          <span>{insights.session_recommendation.modality}</span>
          <span className="meta-label">Notes</span>
          <span>{insights.session_recommendation.notes}</span>
          <span className="meta-label">Est. duration</span>
          <span>{insights.estimated_sessions}</span>
        </div>
      </div>

      {/* Matched partners */}
      {insights.matched_programs?.length > 0 && (
        <div className="drawer-section">
          <h3 className="drawer-section-title">
            <Lightbulb size={15} /> Verified Hub partners — best match
          </h3>
          <p className="muted" style={{ fontSize: "0.79rem", marginBottom: "0.6rem" }}>
            Filtered to Connected to Care verified partners only.
          </p>
          {insights.matched_programs.map((m) => (
            <a
              key={m.id}
              href="https://www.connectedtocare.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="matched-partner-link"
            >
              <div>
                <strong>{m.name}</strong>
                <span>{m.provider} · {m.category}</span>
                <small>{m.reason}</small>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                <span className="confidence-badge">{Math.round(m.confidence * 100)}%</span>
                <ExternalLink size={12} style={{ color: "var(--muted)" }} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
