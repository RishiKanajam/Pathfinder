import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Bot, CheckCircle2,
  Clock, MessageCircle, Moon, Phone, RefreshCw,
  Send, Shield, UserRound, Users, Zap,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

const RISK_COLOR = { low: "#52b788", medium: "#F4A261", high: "#E07A5F" };
const RISK_TEXT  = { low: "#1a4731", medium: "#7a3b0a", high: "#fff" };
const POLL_MS    = 5_000;

function isBusinessHours() {
  const h = new Date().getHours();
  return h >= 9 && h < 17;
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function timeSince(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LiveMonitor({ activeStaff }) {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [joinMsg, setJoinMsg]             = useState("");
  const [joinSent, setJoinSent]           = useState(false);
  const [joining, setJoining]             = useState(false);
  const [notifStatus, setNotifStatus]     = useState(null); // { text, ok }
  const [lastRefresh, setLastRefresh]     = useState(null);
  const endRef      = useRef(null);
  const msgPaneRef  = useRef(null); // scroll within pane, not whole page
  const initialLoad = useRef(true);

  const fetchList = useCallback(async () => {
    try {
      const r = await fetch("/api/conversations");
      if (!r.ok) return;
      const data = await r.json();
      data.sort((a, b) => {
        const o = { high: 0, medium: 1, low: 2 };
        return (o[a.peak_risk_level] - o[b.peak_risk_level]) ||
          (new Date(b.latest_message_at) - new Date(a.latest_message_at));
      });
      setConversations(data);
      setLastRefresh(new Date());
    } finally { setLoading(false); }
  }, []);

  // scroll ONLY within the message pane — never hijack the page
  const scrollMsgs = useCallback(() => {
    if (msgPaneRef.current) {
      msgPaneRef.current.scrollTop = msgPaneRef.current.scrollHeight;
    }
  }, []);

  const fetchDetail = useCallback(async (id, autoScroll = false) => {
    const r = await fetch(`/api/conversations/${id}`);
    if (!r.ok) return;
    setSelected(await r.json());
    if (autoScroll) setTimeout(scrollMsgs, 60);
  }, [scrollMsgs]);

  useEffect(() => {
    fetchList();
    const t = setInterval(fetchList, POLL_MS);
    return () => clearInterval(t);
  }, [fetchList]);

  // Auto-select first conversation on FIRST load only
  useEffect(() => {
    if (initialLoad.current && conversations.length > 0 && !selected) {
      initialLoad.current = false;
      fetchDetail(conversations[0].id, false); // no scroll on auto-select
    }
  }, [conversations, selected, fetchDetail]);

  // Silently refresh selected detail when new messages arrive
  useEffect(() => {
    if (!selected) return;
    const summary = conversations.find(c => c.id === selected.id);
    if (summary && summary.message_count > (selected.messages?.length || 0)) {
      fetchDetail(selected.id, false); // no scroll on background refresh
    }
  }, [conversations]); // eslint-disable-line

  async function sendJoin(e) {
    e?.preventDefault();
    if (!joinMsg.trim() || !selected || !activeStaff) return;
    setJoining(true);
    try {
      await fetch(
        `/api/conversations/${selected.id}/staff-takeover?staff_id=${activeStaff.id}&message=${encodeURIComponent(joinMsg)}`,
        { method: "POST" }
      );
      setJoinSent(true);
      setJoinMsg("");
      await fetchDetail(selected.id);
      setTimeout(() => setJoinSent(false), 3000);
    } finally { setJoining(false); }
  }

  async function sendCriticalAlert() {
    if (!selected) return;
    setNotifStatus({ text: "Sending alert…", ok: null });
    try {
      const r = await fetch("/api/notifications/critical-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selected.id,
          risk_level: selected.peak_risk_level,
          triggered_by: activeStaff?.id,
          message: `HIGH RISK conversation #${selected.id} requires immediate attention. PathFinder has detected a crisis.`,
        }),
      });
      const d = await r.json();
      setNotifStatus({
        text: `Alerted ${d.notified?.length || 0} staff via ${d.channels?.join(", ") || "push"}`,
        ok: true,
      });
    } catch {
      setNotifStatus({ text: "Alert sent (demo mode — configure Twilio for calls)", ok: true });
    }
    setTimeout(() => setNotifStatus(null), 5000);
  }

  const biz = isBusinessHours();

  return (
    <div className="live-monitor">
      {/* ── Conversation list ── */}
      <div className="monitor-list">
        <div className="monitor-list-header">
          <div className="section-heading" style={{ margin: 0 }}>
            <Activity size={16} />
            <h3>Live conversations</h3>
          </div>
          <button className="icon-btn" onClick={fetchList} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>

        {!biz && (
          <div className="monitor-after-hours-notice">
            <Moon size={13} />
            After hours — high-risk cases page on-call staff automatically
          </div>
        )}

        {loading && <div className="monitor-empty"><p style={{ color: "var(--muted)", padding: "2rem" }}>Loading…</p></div>}
        {!loading && conversations.length === 0 && (
          <div className="monitor-empty">
            <MessageCircle size={28} style={{ color: "var(--muted)", opacity: 0.35 }} />
            <p>No active conversations</p>
            <small>New chats appear here in real time</small>
          </div>
        )}

        {conversations.map((c) => {
          const isNew = c.latest_message_at &&
            (Date.now() - new Date(c.latest_message_at).getTime()) < 60_000;
          return (
          <button key={c.id}
            className={`convo-card${selected?.id === c.id ? " selected" : ""}${c.peak_risk_level === "high" ? " urgent" : ""}`}
            onClick={() => fetchDetail(c.id, true)}>
            <div className="convo-card-top">
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLOR[c.peak_risk_level], display: "inline-block", flexShrink: 0 }} />
                <span className="convo-id">#{c.id}</span>
                {c.is_after_hours && <Moon size={10} style={{ color: "var(--muted)" }} />}
                {c.staff_took_over && <Shield size={10} style={{ color: "var(--green-deep)" }} />}
                {isNew && <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "0.05rem 0.35rem", borderRadius: 999, background: "#2d6a4f", color: "#fff", letterSpacing: "0.04em" }}>NEW</span>}
              </div>
              <span className="convo-time">{timeSince(c.latest_message_at)}</span>
            </div>
            <p className="convo-snippet">{c.last_client_snippet || "No messages yet"}</p>
            <div className="convo-card-footer">
              <span style={{
                display: "inline-block", padding: "0.1rem 0.5rem", borderRadius: 999,
                fontSize: "0.68rem", fontWeight: 800,
                background: RISK_COLOR[c.peak_risk_level],
                color: RISK_TEXT[c.peak_risk_level],
              }}>
                {c.peak_risk_level}
              </span>
              <span className="muted" style={{ fontSize: "0.7rem" }}>{c.message_count} msgs</span>
            </div>
          </button>
          );
        })}
      </div>

      {/* ── Detail pane ── */}
      <div className="monitor-detail">
        {!selected ? (
          <div className="monitor-no-selection">
            <Users size={36} style={{ color: "var(--muted)", opacity: 0.3 }} />
            <p>Select a conversation to view</p>
            <small>Risk analysis is staff-only. Users see a clean chat.</small>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="monitor-detail-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                  <h3 style={{ margin: 0 }}>Conversation #{selected.id}</h3>
                  <span style={{
                    padding: "0.2rem 0.6rem", borderRadius: 999,
                    background: RISK_COLOR[selected.peak_risk_level],
                    color: RISK_TEXT[selected.peak_risk_level],
                    fontSize: "0.72rem", fontWeight: 800,
                  }}>
                    Peak: {selected.peak_risk_level}
                  </span>
                  {selected.staff_took_over && (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "var(--green-deep)", fontWeight: 700 }}>
                      <Shield size={11} /> Staff joined
                    </span>
                  )}
                </div>
                <span className="muted" style={{ fontSize: "0.78rem" }}>{selected.messages?.length || 0} messages</span>
              </div>

              {/* Critical alert button */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {selected.peak_risk_level === "high" && (
                  <button className="primary-button"
                    style={{ background: "#C1121F", boxShadow: "0 4px 12px rgba(193,18,31,0.3)", fontSize: "0.82rem", padding: "0.5rem 0.9rem" }}
                    onClick={sendCriticalAlert}>
                    <Bell size={14} /> Alert on-call staff
                  </button>
                )}
                <button className="quiet-button" style={{ fontSize: "0.8rem", padding: "0.45rem 0.75rem" }}
                  onClick={() => fetchDetail(selected.id)}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Notification status */}
            {notifStatus && (
              <div style={{
                padding: "0.6rem 1.1rem", fontSize: "0.8rem", fontWeight: 600,
                background: notifStatus.ok ? "rgba(149,213,178,0.2)" : "var(--coral-pale)",
                color: notifStatus.ok ? "var(--green-deep)" : "#7a2317",
                borderBottom: "1px solid var(--border)",
              }}>
                {notifStatus.ok ? <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: "middle" }} /> : <AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />}
                {notifStatus.text}
              </div>
            )}

            {/* Risk timeline */}
            {selected.risk_timeline?.length > 1 && (
              <div className="risk-timeline-chart">
                <div className="section-heading" style={{ marginBottom: "0.4rem" }}>
                  <Zap size={14} />
                  <h3 style={{ fontSize: "0.82rem" }}>Risk trajectory</h3>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={selected.risk_timeline} margin={{ top: 2, right: 8, left: -32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(43,45,66,0.06)" />
                    <XAxis dataKey="index" tick={{ fontSize: 9 }} tickFormatter={v => `M${v + 1}`} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} tickFormatter={v => `${Math.round(v * 100)}%`} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }}
                      formatter={(v, _, p) => [`${Math.round(v * 100)}% ${p.payload.risk_level}`, "Risk"]}
                      labelFormatter={i => `Message ${i + 1}`} />
                    <Line type="monotone" dataKey="risk_score" stroke="var(--coral)"
                      strokeWidth={2} dot={({ cx, cy, payload }) => (
                        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4}
                          fill={RISK_COLOR[payload.risk_level]} stroke="#fff" strokeWidth={1.5} />
                      )} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Messages — clean layout */}
            <div className="monitor-messages" ref={msgPaneRef}>
              {(selected.messages || []).map((msg, i) => {
                const isClient = msg.role === "client";
                const isStaff  = msg.role === "staff";
                const rLevel   = msg.risk?.level;
                const rScore   = msg.risk?.score;
                const flags    = msg.risk?.flags || [];
                const isHigh   = rLevel === "high";
                const isMedium = rLevel === "medium";

                return (
                  <div key={i} className={`monitor-message-row role-${msg.role}`}>
                    <div className="monitor-avatar">
                      {msg.role === "ai"     && <Bot size={13} />}
                      {isClient              && <UserRound size={13} />}
                      {isStaff               && <Shield size={13} />}
                    </div>

                    <div className="monitor-message-body">
                      {/* Label row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: isStaff ? "var(--green-deep)" : isClient ? "var(--charcoal)" : "var(--muted)" }}>
                          {isStaff ? `${msg.staff_name} (staff)` : isClient ? "User" : "PathFinder"}
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{fmtTime(msg.created_at)}</span>
                        {/* Risk badge — only on client messages */}
                        {isClient && rLevel && (
                          <span style={{
                            padding: "0.08rem 0.45rem", borderRadius: 999,
                            background: RISK_COLOR[rLevel], color: RISK_TEXT[rLevel],
                            fontSize: "0.65rem", fontWeight: 800,
                          }}>
                            {rLevel.toUpperCase()} {rScore != null ? `${Math.round(rScore * 100)}%` : ""}
                          </span>
                        )}
                      </div>

                      {/* Bubble */}
                      <div className="monitor-bubble" style={
                        isHigh   ? { borderLeft: "3px solid #E07A5F", background: "rgba(224,122,95,0.08)" } :
                        isMedium ? { borderLeft: "3px solid #F4A261", background: "rgba(244,162,97,0.07)" } :
                        isStaff  ? { borderLeft: "3px solid var(--green-deep)", background: "rgba(45,106,79,0.07)" } :
                        {}
                      }>
                        {msg.content}
                      </div>

                      {/* Flags — condensed, only for high/medium */}
                      {isClient && flags.length > 0 && (isHigh || isMedium) && (
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                          {flags.slice(0, 2).map((f, fi) => (
                            <span key={fi} className="monitor-flag-chip">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Staff compose */}
            <div className="monitor-compose">
              {biz ? (
                <>
                  <p className="monitor-compose-label">
                    <Shield size={12} />
                    Message as {activeStaff?.name || "staff"} — user sees this in their chat
                  </p>
                  <form className="monitor-input-row" onSubmit={sendJoin}>
                    <input value={joinMsg} onChange={e => setJoinMsg(e.target.value)}
                      placeholder="Type to join this conversation…" disabled={joining} />
                    <button type="submit" className="send-button" disabled={joining || !joinMsg.trim()}>
                      {joinSent ? <CheckCircle2 size={15} /> : <Send size={15} />}
                    </button>
                  </form>
                </>
              ) : (
                <div className="monitor-after-hours-compose">
                  <Moon size={14} />
                  <span>After hours — monitoring only. High-risk cases already paged on-call staff.</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
