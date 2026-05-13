import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Mic,
  MicOff,
  Phone,
  Send,
  UserRound,
} from "lucide-react";
import { api } from "../lib/api.js";
import CrisisResources from "../components/CrisisResources.jsx";

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
    "Hi, I'm glad you're here. I'm PathFinder — a support guide for the Evolve Mental Health & Wellbeing Hub in the Hunter Region.\n\nYou can share as much or as little as you'd like. There's no right way to start. I'm here to listen and help connect you with the right support, at your pace.\n\nIf you're in immediate danger right now, please call 000 or Lifeline on 13 11 14.",
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

  // Computed for staff-facing use — not rendered in the public chat
  // eslint-disable-next-line no-unused-vars
  const riskPercent = Math.max(Math.round(risk.score * 100), 5);
  // eslint-disable-next-line no-unused-vars
  const elevatedEmotions = Object.entries(risk.emotions || {})
    .filter(([, v]) => v > 0.15)
    .sort(([, a], [, b]) => b - a);

  return (
    <section style={{ maxWidth: "740px", margin: "0 auto", padding: "1rem clamp(0.75rem, 3vw, 1.5rem)" }}>
      {/* ── Main chat panel ── */}
      <div className="chat-panel" style={{ minHeight: "calc(100vh - 180px)", maxHeight: "calc(100vh - 180px)" }}>
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

          {/* Warm staff-notification notice — shown when escalation fires */}
          {escalation && (
            <div style={{
              display: "flex", gap: "0.65rem", alignItems: "flex-start",
              padding: "0.9rem 1.1rem", margin: "0.25rem 0",
              background: "rgba(45,106,79,0.07)", border: "1px solid rgba(45,106,79,0.2)",
              borderRadius: "var(--radius-lg)", animation: "fadeUp 0.3s ease",
            }}>
              <CheckCircle size={18} style={{ color: "var(--green-deep)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--green-deep)", fontSize: "0.9rem" }}>
                  Our team has been notified
                </p>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem", color: "var(--body-text)", lineHeight: 1.55 }}>
                  A member of the Evolve Hub team will follow up with you. You don't have to go through this alone.
                  If you need someone right now, Lifeline is available 24/7 on{" "}
                  <a href="tel:131114" style={{ fontWeight: 700, color: "var(--green-deep)" }}>13 11 14</a>.
                </p>
              </div>
            </div>
          )}

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

    </section>
  );
}
