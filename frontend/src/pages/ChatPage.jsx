import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  Mic,
  MicOff,
  Phone,
  Send,
  UserRound,
  Zap,
} from "lucide-react";
import { api, riskLabel } from "../lib/api.js";
import CrisisResources from "../components/CrisisResources.jsx";
import EscalationStatus from "../components/EscalationStatus.jsx";

const CRISIS_CONTACTS = [
  { label: "000",            description: "Emergency",            href: "tel:000",          emergency: true },
  { label: "13 11 14",       description: "Lifeline 24/7",        href: "tel:131114" },
  { label: "1800 011 511",   description: "NSW Mental Health",    href: "tel:1800011511" },
  { label: "1300 22 4636",   description: "Beyond Blue",          href: "tel:1300224636" },
  { label: "13 92 76",       description: "13YARN (ATSI 24/7)",   href: "tel:139276" },
  { label: "02 4096 1100",   description: "Evolve Hub",           href: "tel:0240961100" },
];

const OPENING_MESSAGE = {
  role: "ai",
  content:
    "Hi there. I'm PathFinder, an AI support guide for the Evolve Mental Health & Wellbeing Hub in the Hunter Region. You can share as much or as little as you like — I'm here to listen and help you find the right support.\n\nIf you're in immediate danger, please call 000 or Lifeline on 13 11 14 right now.",
  timestamp: new Date().toISOString(),
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState([OPENING_MESSAGE]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [risk, setRisk] = useState({ level: "low", score: 0.05, flags: [], emotions: {} });
  const [matches, setMatches] = useState([]);
  const [escalation, setEscalation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [afterHours, setAfterHours] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Detect after-hours
  useEffect(() => {
    const hour = new Date().getHours();
    setAfterHours(hour < 9 || hour >= 17);
  }, []);

  async function sendMessage(event) {
    event?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "client", content: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    inputRef.current?.focus();

    try {
      const result = await api.chat({ message: trimmed, conversation_id: conversationId });
      setConversationId(result.conversation_id);
      setRisk(result.risk);
      setMatches(result.matches || []);
      setEscalation(result.escalation || null);
      setAfterHours(result.after_hours ?? afterHours);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: result.reply, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "I'm having trouble reaching the PathFinder service right now. If this is urgent, please call 000 or Lifeline on 13 11 14.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  }

  function toggleMic() {
    if (!navigator.mediaDevices) return;
    if (isRecording) {
      setIsRecording(false);
    } else {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => setIsRecording(true))
        .catch(() => alert("Microphone access denied."));
    }
  }

  const showCrisisBanner = risk.level === "high";
  const riskPercent = Math.max(Math.round(risk.score * 100), 5);

  // Highlight elevated emotions
  const elevatedEmotions = Object.entries(risk.emotions || {})
    .filter(([, v]) => v > 0.15)
    .sort(([, a], [, b]) => b - a);

  return (
    <section className="chat-layout">
      {/* ── Main chat panel ── */}
      <div className="chat-panel">
        <div className="chat-header">
          <div className="chat-header-left">
            <p className="eyebrow">Evolve Hub · 24 / 7 intake</p>
            <h2>PathFinder Support Guide</h2>
            <div className="online-indicator">
              <span className="online-dot" />
              Available now
              {afterHours && (
                <span className="after-hours-badge" style={{ marginLeft: "0.5rem" }}>
                  After hours
                </span>
              )}
            </div>
          </div>
          <a href="tel:0240961100" className="quiet-button" style={{ textDecoration: "none" }}>
            <Phone size={16} />
            Talk to a person
          </a>
        </div>

        {/* Inline crisis banner — appears when risk is high */}
        {showCrisisBanner && (
          <div className="crisis-banner">
            <div className="crisis-banner-title">
              <AlertTriangle size={18} color="#7a2317" />
              If you're in danger right now, these services are available 24/7
            </div>
            <div className="crisis-numbers">
              {CRISIS_CONTACTS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className={`crisis-number-link${c.emergency ? " emergency" : ""}`}
                >
                  <strong>{c.label}</strong>
                  <small>{c.description}</small>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="message-list">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`message-row ${msg.role}`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className={`avatar ${msg.role === "ai" ? "ai-avatar" : "client-avatar"}`}>
                {msg.role === "ai" ? <Bot size={17} /> : <UserRound size={17} />}
              </div>
              <div>
                <div className="message-bubble">{msg.content}</div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}

          {/* EscalationStatus displayed inline when triggered */}
          {escalation && <EscalationStatus escalation={escalation} />}

          {/* Typing indicator */}
          {loading && (
            <div className="message-row ai">
              <div className="avatar ai-avatar">
                <Bot size={17} />
              </div>
              <div>
                <div className="typing-indicator">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="chat-composer">
          <div className="composer-input-row">
            <button
              type="button"
              className={`mic-button${isRecording ? " recording" : ""}`}
              onClick={toggleMic}
              title={isRecording ? "Stop recording" : "Start voice input"}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's been going on for you lately?"
              aria-label="Message"
              disabled={loading}
            />

            <button
              type="button"
              className="send-button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>

          <a href="tel:0240961100" className="talk-to-person" style={{ textDecoration: "none" }}>
            <Phone size={14} />
            Prefer to talk to someone? Call the Evolve Hub on 02 4096 1100
          </a>
        </div>
      </div>

      {/* ── Insight panel (right side) ── */}
      <aside className="insight-panel">
        {/* Risk signal */}
        <div className="panel-section">
          <div className="section-heading">
            <Zap size={17} />
            <h3>Live risk signal</h3>
          </div>
          <span className={`risk-badge ${risk.level}`}>{riskLabel[risk.level]} risk</span>
          <div className="meter" style={{ marginTop: "0.75rem" }}>
            <div className="meter-fill" style={{ width: `${riskPercent}%` }} />
          </div>
          <p className="muted">
            Score {riskPercent} / 100.{" "}
            {risk.level === "high"
              ? "Staff have been alerted."
              : "Used by staff as a prompt — not a diagnosis."}
          </p>

          {/* Detected emotions */}
          {elevatedEmotions.length > 0 && (
            <div className="emotion-chips" style={{ marginTop: "0.6rem" }}>
              {elevatedEmotions.map(([emotion, score]) => (
                <span
                  key={emotion}
                  className={`emotion-chip${score > 0.4 ? " elevated" : ""}`}
                >
                  {emotion} {Math.round(score * 100)}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Detected flags */}
        <div className="panel-section">
          <div className="section-heading">
            <AlertTriangle size={17} />
            <h3>Detected signals</h3>
          </div>
          {risk.flags?.length ? (
            <ul className="flags-list">
              {risk.flags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No elevated language detected yet.</p>
          )}
        </div>

        {/* Program matches */}
        <div className="panel-section">
          <div className="section-heading">
            <Bot size={17} />
            <h3>Suggested programs</h3>
          </div>
          <div className="program-cards-scroll">
            {matches.length ? (
              matches.map((match, idx) => (
                <article
                  className="program-card"
                  key={match.id}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="program-card-top">
                    <strong>{match.name}</strong>
                    <span className="confidence-badge">
                      {Math.round(match.confidence * 100)}% fit
                    </span>
                  </div>
                  <span className="provider">{match.provider}</span>
                  <p className="reason">{match.reason}</p>
                  <a
                    href="https://www.connectedtocare.com.au"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="learn-more-link"
                  >
                    Learn more <ExternalLink size={11} />
                  </a>
                </article>
              ))
            ) : (
              <p className="muted">Program matches will appear after you send your first message.</p>
            )}
          </div>
        </div>

        {/* After-hours note */}
        {afterHours && (
          <div className="panel-section">
            <div className="safety-note" style={{ fontSize: "0.82rem" }}>
              <Phone size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                The Evolve Hub is currently closed (open 9am–5pm Mon–Fri). Your referral will be
                reviewed first thing next business day. For immediate help, call Lifeline{" "}
                <a href="tel:131114" style={{ fontWeight: 700 }}>13 11 14</a>.
              </span>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}
