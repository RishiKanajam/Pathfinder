import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Clock3,
  Download,
  FileText,
  MapPin,
  Pencil,
  TrendingUp,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, riskLabel, statusColumns } from "../lib/api.js";
import ReferralDrawer from "../components/referral/ReferralDrawer.jsx";
import LiveMonitor from "../components/dashboard/LiveMonitor.jsx";

const RISK_COLORS  = { low: "#95D5B2", medium: "#F4A261", high: "#E07A5F" };
const SOURCE_COLORS = ["#2D6A4F", "#4F7F6A", "#95D5B2", "#DDA15E", "#E07A5F", "#9B8AC4", "#6B7280", "#C8A96E"];

// Role-based profile — controls what each staff member sees
function getRoleProfile(staff) {
  if (!staff) return { isCEO: true, showGrantTools: true, showEscalation: true, showRiskQueue: true, showVolunteers: true, eyebrow: "Staff dashboard" };
  const role = staff.role.toLowerCase();
  const isCEO       = role === "ceo";
  const isCommunity = role.includes("community") || role.includes("fundraising");
  return {
    isCEO,
    isCommunity,
    showGrantTools:  isCEO,
    showEscalation:  !isCommunity,
    showRiskQueue:   !isCommunity,
    showVolunteers:  isCEO || isCommunity,
    eyebrow: isCEO ? "Executive overview" : isCommunity ? "Outreach & community" : "Staff dashboard",
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardPage({ activeStaff }) {
  const [referrals, setReferrals] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [staff, setStaff] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [escalationMetrics, setEscalationMetrics] = useState(null);
  const [overnightSummary, setOvernightSummary] = useState(null);
  const [activeStatus, setActiveStatus] = useState("new");
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [drawerTab, setDrawerTab] = useState("detail");

  useEffect(() => {
    Promise.all([
      api.referrals(),
      api.analytics(),
      api.staff(),
      api.volunteers(),
      fetch("/api/escalations/overnight-summary").then((r) => r.json()).catch(() => null),
      fetch("/api/escalations/metrics/response-times").then((r) => r.json()).catch(() => null),
    ]).then(([refs, anal, st, vols, summary, metrics]) => {
      setReferrals(refs);
      setAnalytics(anal);
      setStaff(st);
      setVolunteers(vols);
      setOvernightSummary(summary);
      setEscalationMetrics(metrics);
    }).catch(() => {});
  }, []);

  const priorityQueue = useMemo(
    () => [...referrals].sort((a, b) => b.risk_score - a.risk_score).slice(0, 6),
    [referrals]
  );

  const sourceData = toChart(analytics?.source_counts).map((d) => ({
    ...d,
    name: SOURCE_LABELS[d.name] || d.name,
  }));
  const riskData   = toChart(analytics?.risk_counts);
  const programData = toChart(analytics?.program_counts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((d) => ({ ...d, name: d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name }));
  const timelineData = analytics?.referrals_over_time || [];
  const responseData = analytics?.response_times || [];

  const profile       = getRoleProfile(activeStaff);
  const highRiskCount = referrals.filter((r) => r.risk_level === "high").length;
  const openCount     = referrals.filter((r) => r.status === "new" || r.status === "assigned").length;
  const myCases       = useMemo(
    () => referrals.filter((r) => r.assigned_to === activeStaff?.id),
    [referrals, activeStaff?.id]
  );
  const activeColumn = statusColumns.find((col) => col.key === activeStatus) || statusColumns[0];
  const activeReferrals = referrals
    .filter((r) => r.status === activeStatus)
    .sort((a, b) => b.risk_score - a.risk_score || new Date(b.created_at) - new Date(a.created_at));

  function openReferral(referral, tab = "detail") {
    setSelectedReferral(referral);
    setDrawerTab(tab);
  }

  function applyReferralUpdate(updated) {
    setReferrals((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedReferral(updated);
    if (updated.status && updated.status !== activeStatus) {
      setActiveStatus(updated.status);
    }
  }

  function exportReport() {
    const rows = [
      ["ID", "Client", "Status", "Risk", "Source", "Created"],
      ...referrals.map((r) => [r.id, r.client_name, r.status, r.risk_level, r.source_tag, r.created_at]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pathfinder-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="dashboard">
      {/* ── Dashboard header ── */}
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">{profile.eyebrow} · LMNSPN Evolve Hub</p>
          <h2>{greeting()}, {activeStaff?.name ?? "Bradley"}</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "0.25rem 0 0" }}>
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {highRiskCount > 0 && (
              <span className="risk-badge high" style={{ marginLeft: "0.75rem", verticalAlign: "middle" }}>
                {highRiskCount} high-risk {highRiskCount === 1 ? "case" : "cases"}
              </span>
            )}
          </p>
        </div>
        <div className="dashboard-actions">
          {profile.showGrantTools && (
            <button className="quiet-button">
              <FileText size={16} />
              Grant report
            </button>
          )}
          {profile.showGrantTools && (
            <button className="primary-button" onClick={exportReport}>
              <Download size={16} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Metric tiles ── */}
      <div className="metric-grid">
        <MetricCard label="Total referrals" value={referrals.length} detail="All time in PathFinder" />
        <MetricCard label="Open cases" value={openCount} detail="New + assigned" accent={openCount > 5} />
        <MetricCard label="High priority" value={highRiskCount} detail="Needs senior review" accent={highRiskCount > 0} />
        <MetricCard label="After-hours" value={analytics?.after_hours?.after_hours ?? 0} detail="Captured outside 9–5" />
        <MetricCard label="Active escalations" value={overnightSummary?.total_escalations ?? 0} detail="High-risk flagged" accent={(overnightSummary?.total_escalations ?? 0) > 0} />
        <MetricCard label="Unacknowledged" value={overnightSummary?.unacknowledged_count ?? 0} detail="Awaiting staff response" accent={(overnightSummary?.unacknowledged_count ?? 0) > 0} />
        <MetricCard
          label="Avg response time"
          value={escalationMetrics?.avg_response_time_minutes != null ? `${escalationMetrics.avg_response_time_minutes}m` : "—"}
          detail="Staff acknowledgment"
        />
        <MetricCard label="Volunteers" value={volunteers.length} detail="Rostered in PathFinder" />
      </div>

      {/* ── Main grid ── */}
      <div className="dashboard-grid">

        {/* Pipeline tabs */}
        <section className="wide-panel" style={{ gridColumn: "span 4" }}>
          <div className="section-heading">
            <TrendingUp size={18} />
            <h3>Referral pipeline</h3>
            <span className="muted" style={{ marginLeft: "auto", fontSize: "0.8rem" }}>
              {referrals.length} total referrals
            </span>
          </div>
          <div className="pipeline-workspace">
            <nav className="pipeline-tabs" aria-label="Referral pipeline stages">
              {statusColumns.map((col) => {
                const count = referrals.filter((r) => r.status === col.key).length;
                const highestRisk = referrals
                  .filter((r) => r.status === col.key)
                  .sort((a, b) => b.risk_score - a.risk_score)[0]?.risk_level || "low";
                return (
                  <button
                    key={col.key}
                    className={`pipeline-tab${activeStatus === col.key ? " active" : ""}`}
                    onClick={() => setActiveStatus(col.key)}
                  >
                    <span className={`risk-dot ${highestRisk}`} />
                    <span>{col.label}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </nav>

            <div className="pipeline-stage">
              <div className="pipeline-stage-head">
                <div>
                  <p className="eyebrow">Pipeline stage</p>
                  <h4>{activeColumn.label}</h4>
                </div>
                <span className="stage-count">{activeReferrals.length} cases</span>
              </div>

              <div className="pipeline-case-list">
                {activeReferrals.map((ref, idx) => {
                  const assignee = staff.find((s) => s.id === ref.assigned_to);
                  return (
                    <article
                      className="referral-card pipeline-case-card"
                      key={ref.id}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      onClick={() => openReferral(ref, "detail")}
                    >
                      <div className="referral-card-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span className={`risk-dot ${ref.risk_level}`} />
                          <strong>{ref.client_name}</strong>
                        </div>
                        <span className="source-tag">{ref.source_tag?.split("-").slice(-1)[0] || "web"}</span>
                      </div>
                      <p>{ref.situation}</p>
                      <div className="case-card-footer">
                        <small>
                          {riskLabel[ref.risk_level]} risk ·{" "}
                          {assignee ? assignee.name : "Unassigned"} ·{" "}
                          {timeAgo(ref.created_at)}
                        </small>
                        <div className="case-card-actions">
                          <button
                            type="button"
                            className="mini-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReferral(ref, "detail");
                            }}
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="mini-action primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReferral(ref, "insights");
                            }}
                          >
                            <Zap size={13} />
                            Case insights
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {activeReferrals.length === 0 && (
                  <div className="empty-stage">
                    <strong>No cases here yet</strong>
                    <span>Move a referral into {activeColumn.label.toLowerCase()} and it will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Risk queue */}
        <section className="side-panel" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <BellRing size={18} />
            <h3>Risk priority queue</h3>
          </div>
          <div className="priority-list">
            {priorityQueue.map((ref, idx) => (
              <article key={ref.id} style={{ animationDelay: `${idx * 50}ms` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <span className={`risk-badge ${ref.risk_level}`}>
                    {riskLabel[ref.risk_level]}
                  </span>
                  <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{timeAgo(ref.created_at)}</small>
                </div>
                <strong>{ref.client_name}</strong>
                <p>{ref.ai_assessment?.summary || ref.situation?.slice(0, 80)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Escalation status */}
        <section className="side-panel" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <AlertTriangle size={18} />
            <h3>Escalation monitor</h3>
          </div>
          {overnightSummary ? (
            <div className="escalation-summary">
              <div className="summary-item">
                <strong>High-risk cases</strong>
                <span>{overnightSummary.total_escalations}</span>
              </div>
              <div className="summary-item">
                <strong>Unacknowledged</strong>
                <span className={overnightSummary.unacknowledged_count > 0 ? "warning" : ""}>
                  {overnightSummary.unacknowledged_count}
                </span>
              </div>
              <div className="summary-item">
                <strong>System failures</strong>
                <span className={overnightSummary.system_failures_count > 0 ? "critical" : ""}>
                  {overnightSummary.system_failures_count}
                </span>
              </div>
              {overnightSummary.urgent_follow_ups?.length > 0 && (
                <>
                  <p className="subtitle" style={{ margin: "0.75rem 0 0.3rem" }}>Urgent follow-ups</p>
                  {overnightSummary.urgent_follow_ups.slice(0, 3).map((item) => (
                    <div key={item.escalation_id} className={`urgent-item ${item.priority.toLowerCase()}`}>
                      <span className="priority-badge">{item.priority}</span>
                      <small>Case #{item.escalation_id} · Layer {item.escalation_layer} · {item.time_since_contact_minutes}m elapsed</small>
                    </div>
                  ))}
                </>
              )}
              {overnightSummary.total_escalations === 0 && (
                <p className="muted" style={{ fontSize: "0.85rem" }}>No active escalations. All clear.</p>
              )}
            </div>
          ) : (
            <p className="muted">No escalation data available.</p>
          )}
        </section>

        {/* Referrals by source */}
        <section className="chart-panel">
          <div className="section-heading">
            <MapPin size={17} />
            <h3>Referrals by source</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sourceData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(43,45,66,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(43,45,66,0.1)", boxShadow: "0 4px 16px rgba(43,45,66,0.12)" }} />
              <Bar dataKey="value" fill="#2D6A4F" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Risk distribution */}
        <section className="chart-panel">
          <div className="section-heading">
            <Zap size={17} />
            <h3>Risk distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={riskData}
                dataKey="value"
                nameKey="name"
                outerRadius={82}
                innerRadius={40}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                labelLine={false}
              >
                {riskData.map((entry) => (
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#DDA15E"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(43,45,66,0.1)" }} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        {/* Referrals over time */}
        <section className="chart-panel">
          <div className="section-heading">
            <TrendingUp size={17} />
            <h3>Referrals over time</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(43,45,66,0.06)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(43,45,66,0.1)" }} />
              <Line type="monotone" dataKey="count" stroke="#2D6A4F" strokeWidth={3} dot={{ r: 5, fill: "#2D6A4F" }} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Program demand */}
        <section className="chart-panel">
          <div className="section-heading">
            <UsersRound size={17} />
            <h3>Program demand</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={programData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(43,45,66,0.06)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(43,45,66,0.1)" }} />
              <Bar dataKey="value" fill="#95D5B2" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* AI alerts */}
        <section className="side-panel" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <Clock3 size={18} />
            <h3>AI anomaly alerts</h3>
          </div>
          <div className="alert-stack">
            {(analytics?.alerts || []).map((alert, i) => (
              <div className="alert-item" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "2px", color: "var(--sand)" }} />
                <span>{alert}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Hunter Region heatmap placeholder */}
        <section className="side-panel" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <MapPin size={18} />
            <h3>Hunter Region referral map</h3>
          </div>
          <HunterHeatmap analytics={analytics} />
        </section>

        {/* Live conversation monitor */}
        <section className="wide-panel" style={{ gridColumn: "span 4", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem 0.75rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Activity size={18} style={{ color: "var(--green-mid)" }} />
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: "1rem" }}>Live conversation monitor</h3>
            <span className="muted" style={{ fontSize: "0.78rem", marginLeft: "0.25rem" }}>Staff-only · users see a clean chat</span>
            <span className="system-pill" style={{ marginLeft: "auto", fontSize: "0.72rem" }}>
              <span className="live-dot" />
              Real-time risk analysis
            </span>
          </div>
          <LiveMonitor activeStaff={activeStaff} />
        </section>

        {/* Volunteer roster */}
        <section className="side-panel" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <UsersRound size={18} />
            <h3>Volunteer roster</h3>
          </div>
          <div className="volunteer-list">
            {volunteers.map((vol) => (
              <article key={vol.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong>{vol.name}</strong>
                  <span
                    className="risk-badge"
                    style={{
                      background: vol.training_status === "advanced" ? "var(--green-pale)" : "rgba(43,45,66,0.07)",
                      color: vol.training_status === "advanced" ? "var(--green-deep)" : "var(--muted)",
                      fontSize: "0.68rem",
                    }}
                  >
                    {vol.training_status}
                  </span>
                </div>
                <span>{vol.availability}</span>
                <small>{(Array.isArray(vol.skills) ? vol.skills : [vol.skills]).join(", ")} · {vol.total_hours} hrs</small>
              </article>
            ))}
          </div>
        </section>

        {/* Response times */}
        <section className="chart-panel" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <Clock3 size={17} />
            <h3>Time to first contact (hours)</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={responseData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(43,45,66,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(43,45,66,0.1)" }} />
              <Line type="monotone" dataKey="hours" stroke="#DDA15E" strokeWidth={3} dot={{ r: 5, fill: "#DDA15E" }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
      {selectedReferral && (
        <ReferralDrawer
          referral={selectedReferral}
          staff={staff}
          initialTab={drawerTab}
          onClose={() => setSelectedReferral(null)}
          onUpdated={applyReferralUpdate}
        />
      )}
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MetricCard({ label, value, detail, accent = false }) {
  return (
    <article className="metric-card" style={accent ? { borderColor: "rgba(224,122,95,0.3)" } : {}}>
      <span>{label}</span>
      <strong style={accent ? { color: "#b84b42" } : {}}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

// Hunter Region LGA heatmap (SVG-based placeholder with real suburb data)
function HunterHeatmap({ analytics }) {
  const suburbs = analytics?.suburb_counts || {};
  const maxVal = Math.max(...Object.values(suburbs), 1);

  const REGIONS = [
    { name: "Charlestown",   x: 165, y: 120, lga: "Lake Macquarie" },
    { name: "Hamilton",      x: 195, y: 85,  lga: "Newcastle" },
    { name: "Mayfield",      x: 210, y: 70,  lga: "Newcastle" },
    { name: "Elermore Vale", x: 145, y: 100, lga: "Lake Macquarie" },
    { name: "Belmont",       x: 185, y: 145, lga: "Lake Macquarie" },
    { name: "Swansea",       x: 205, y: 170, lga: "Lake Macquarie" },
    { name: "Maitland",      x: 120, y: 65,  lga: "Maitland" },
    { name: "Cessnock",      x: 80,  y: 85,  lga: "Cessnock" },
    { name: "Rutherford",    x: 100, y: 55,  lga: "Maitland" },
    { name: "Jesmond",       x: 180, y: 60,  lga: "Newcastle" },
    { name: "Lambton",       x: 190, y: 80,  lga: "Newcastle" },
    { name: "Morisset",      x: 145, y: 175, lga: "Lake Macquarie" },
  ];

  function heatColor(count) {
    if (!count) return "rgba(149,213,178,0.15)";
    const ratio = count / maxVal;
    if (ratio > 0.7) return "rgba(224,122,95,0.75)";
    if (ratio > 0.4) return "rgba(244,162,97,0.65)";
    return "rgba(149,213,178,0.55)";
  }

  return (
    <div style={{ position: "relative", textAlign: "center" }}>
      <svg viewBox="0 0 320 220" style={{ width: "100%", maxHeight: 200, display: "block" }}>
        {/* Simplified Hunter Region outline */}
        <path
          d="M 60 40 L 240 20 L 280 80 L 260 180 L 220 200 L 140 200 L 80 180 L 50 120 Z"
          fill="rgba(45,106,79,0.05)"
          stroke="rgba(45,106,79,0.2)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* Coastline hint */}
        <path
          d="M 220 200 Q 250 195 260 180"
          fill="none"
          stroke="rgba(79,127,200,0.3)"
          strokeWidth="2"
        />
        {/* Region dots */}
        {REGIONS.map((r) => {
          const count = suburbs[r.name] || 0;
          const radius = count ? Math.max(10, count * 4) : 8;
          return (
            <g key={r.name}>
              <circle
                cx={r.x} cy={r.y}
                r={radius}
                fill={heatColor(count)}
                stroke={count ? "rgba(43,45,66,0.15)" : "rgba(43,45,66,0.08)"}
                strokeWidth="1"
              />
              <text
                x={r.x} y={r.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={count ? "7.5" : "7"}
                fill={count > 2 ? "#2B2D42" : "#6B7280"}
                fontWeight={count ? "700" : "400"}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {r.name.split(" ")[0]}
              </text>
              {count > 0 && (
                <text
                  x={r.x} y={r.y + 9}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="6.5"
                  fill="#2B2D42"
                  fontWeight="800"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}
        {/* Legend */}
        <g transform="translate(8, 195)">
          <circle cx="6" cy="6" r="5" fill="rgba(149,213,178,0.55)" />
          <text x="14" y="10" fontSize="7" fill="#6B7280">Low</text>
          <circle cx="38" cy="6" r="5" fill="rgba(244,162,97,0.65)" />
          <text x="46" y="10" fontSize="7" fill="#6B7280">Med</text>
          <circle cx="70" cy="6" r="5" fill="rgba(224,122,95,0.75)" />
          <text x="78" y="10" fontSize="7" fill="#6B7280">High</text>
        </g>
      </svg>
      <p className="muted" style={{ fontSize: "0.72rem", marginTop: "0.25rem" }}>
        Referral density by suburb · Hunter Region LGAs
      </p>
    </div>
  );
}

function toChart(obj = {}) {
  return Object.entries(obj).map(([name, value]) => ({ name, value }));
}

const SOURCE_LABELS = {
  gaming_centre: "Gaming",
  gp: "GP",
  self: "Self",
  friend: "Friend",
  family: "Family",
  school: "School",
  agency: "Agency",
  community_org: "Community",
  chat_widget: "Chat",
  "chat-widget": "Chat",
  "qr-community": "QR",
};
