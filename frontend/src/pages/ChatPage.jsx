import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bot, ExternalLink,
  Loader2, Mic, MicOff, Phone, Send, UserRound, X,
} from "lucide-react";

const API = "/api";

const CRISIS_NUMBERS = [
  { label: "000",            description: "Emergency — call now",      href: "tel:000",       primary: true },
  { label: "13 11 14",       description: "Lifeline · 24/7",           href: "tel:131114" },
  { label: "1800 011 511",   description: "NSW Mental Health Line",    href: "tel:1800011511" },
  { label: "13 92 76",       description: "13YARN · Aboriginal & TSI", href: "tel:139276" },
  { label: "1300 22 4636",   description: "Beyond Blue",               href: "tel:1300224636" },
  { label: "02 4096 1100",   description: "Evolve Hub",                href: "tel:0240961100" },
];

const OPENING_MSG = {
  role: "ai", streaming: false,
  content: "Hi there. I'm PathFinder, an AI support guide for the Evolve Mental Health & Wellbeing Hub. You can share as much or as little as you like — I'm here to listen.\n\nIf you're in immediate danger, please call 000 or Lifeline on 13 11 14.",
  ts: new Date().toISOString(),
};

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// Blinking cursor for streaming messages
function StreamCursor() {
  return <span className="stream-cursor">▍</span>;
}

export default function ChatPage() {
  const [messages, setMessages]             = useState([OPENING_MSG]);
  const [input, setInput]                   = useState("");
  const [conversationId, setCid]            = useState(null);
  const [streaming, setStreaming]           = useState(false);
  const [afterHours, setAfterHours]         = useState(false);
  const [showCrisisPanel, setShowCrisisPanel] = useState(false);
  const [programMatches, setProgramMatches] = useState([]);

  // Voice
  const [isRecording, setIsRecording]       = useState(false);
  const [transcribing, setTranscribing]     = useState(false);
  const [recSeconds, setRecSeconds]         = useState(0);
  const [voiceError, setVoiceError]         = useState("");

  const endRef           = useRef(null);
  const inputRef         = useRef(null);
  const recorderRef      = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const convIdRef        = useRef(null);  // always-current ref for closures

  useEffect(() => { convIdRef.current = conversationId; }, [conversationId]);

  useEffect(() => {
    setAfterHours(new Date().getHours() < 9 || new Date().getHours() >= 17);
    return () => { clearInterval(timerRef.current); recorderRef.current?.stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── Send with streaming ────────────────────────────────────

  async function sendMessage(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    if (!textOverride) setInput("");

    const userMsg = { role: "client", content: text, ts: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setStreaming(true);

    // Placeholder streaming message
    const placeholder = { role: "ai", content: "", streaming: true, ts: new Date().toISOString() };
    setMessages(m => [...m, placeholder]);

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversation_id: convIdRef.current }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.delta) {
              accumulated += parsed.delta;
              setMessages(m => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last?.streaming) copy[copy.length - 1] = { ...last, content: accumulated };
                return copy;
              });
            }
            // Metadata sent at stream start
            if (parsed.meta) {
              if (parsed.meta.risk?.level === "high") setShowCrisisPanel(true);
              if (parsed.meta.matches?.length) setProgramMatches(parsed.meta.matches.slice(0, 3));
            }
            // Final event — conversation saved, conv_id available
            if (parsed.conv_id) setCid(parsed.conv_id);
          } catch {}
        }
      }

      // Mark streaming done
      setMessages(m => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.streaming) copy[copy.length - 1] = { ...last, streaming: false };
        return copy;
      });

      // conv_id, risk, matches all come via stream events — no second fetch needed

    } catch (err) {
      setMessages(m => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.streaming || last?.content === "") {
          copy[copy.length - 1] = {
            role: "ai", streaming: false,
            content: "I'm having trouble connecting. If this is urgent, call 000 or Lifeline on 13 11 14.",
            ts: new Date().toISOString(),
          };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  // ── Voice recording ────────────────────────────────────────

  async function toggleMic() {
    setVoiceError("");
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone not supported in this browser.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setVoiceError(e.name === "NotAllowedError" ? "Microphone access denied — allow it in your browser settings." : "Could not access microphone.");
      return;
    }

    // Pick best supported MIME type
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find(t => MediaRecorder.isTypeSupported(t)) || "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    recorderRef.current = recorder;
    chunksRef.current   = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    recorder.onstop = async () => {
      clearInterval(timerRef.current);
      setRecSeconds(0);
      setIsRecording(false);
      stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      if (blob.size < 2000) { setVoiceError("Recording too short — try again."); return; }

      setTranscribing(true);
      try {
        const res = await fetch(`${API}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": mimeType || "audio/webm" },
          body: blob,
        });
        const data = await res.json();

        if (data.text?.trim()) {
          const transcript = data.text.trim();
          setInput(transcript);
          // Short delay so user sees the transcript, then auto-send
          setTimeout(() => sendMessage(transcript), 500);
        } else {
          setVoiceError(data.error || "Could not transcribe audio — try typing instead.");
        }
      } catch {
        setVoiceError("Transcription failed — please type your message.");
      } finally {
        setTranscribing(false);
      }
    };

    recorder.start(250);
    setIsRecording(true);

    // Timer — max 60s
    let secs = 0;
    timerRef.current = setInterval(() => {
      secs++;
      setRecSeconds(secs);
      if (secs >= 60) recorder.stop();
    }, 1000);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const busy = streaming || transcribing;

  return (
    <section className={`chat-layout${showCrisisPanel ? " with-crisis-panel" : ""}`}>
      <div className="chat-panel">

        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <p className="eyebrow">Evolve Hub · open 24 / 7</p>
            <h2>PathFinder Support</h2>
            <div className="online-indicator">
              <span className="online-dot" />
              {afterHours ? "After hours — follow-up tomorrow" : "Available now"}
            </div>
          </div>
          <a href="tel:0240961100" className="quiet-button" style={{ textDecoration: "none", flexShrink: 0 }}>
            <Phone size={15} /> Talk to a person
          </a>
        </div>

        {/* Messages */}
        <div className="message-list">
          {messages.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role}`} style={{ animationDelay: `${Math.min(i, 5) * 25}ms` }}>
              <div className={`avatar ${msg.role === "ai" ? "ai-avatar" : "client-avatar"}`}>
                {msg.role === "ai" ? <Bot size={16} /> : <UserRound size={16} />}
              </div>
              <div>
                <div className={`message-bubble${msg.streaming ? " streaming" : ""}`}>
                  {msg.content}
                  {msg.streaming && msg.content && <StreamCursor />}
                  {msg.streaming && !msg.content && (
                    <div className="typing-indicator">
                      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                    </div>
                  )}
                </div>
                {!msg.streaming && <div className="message-time">{fmtTime(msg.ts)}</div>}
              </div>
            </div>
          ))}

          {/* Transcribing indicator */}
          {transcribing && (
            <div className="message-row ai">
              <div className="avatar ai-avatar"><Loader2 size={16} className="spin" /></div>
              <div>
                <div className="typing-indicator voice-transcribing">
                  <Mic size={13} style={{ color: "var(--coral)" }} />
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Transcribing voice…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Program suggestions */}
        {programMatches.length > 0 && (
          <div className="program-suggestions-strip">
            <p className="suggestions-label">Based on what you've shared, some people who might be able to help:</p>
            <div className="suggestions-row">
              {programMatches.map(m => (
                <a key={m.id} href="https://www.connectedtocare.com.au" target="_blank" rel="noopener noreferrer" className="suggestion-chip">
                  <strong>{m.name}</strong>
                  <span>{m.provider}</span>
                  <ExternalLink size={11} style={{ flexShrink: 0, color: "var(--muted)" }} />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="chat-composer">
          <div className="composer-input-row">
            <button type="button"
              className={`mic-button${isRecording ? " recording" : ""}${transcribing ? " transcribing" : ""}`}
              onClick={toggleMic} disabled={busy && !isRecording}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              title={isRecording ? `Recording ${recSeconds}s — tap to stop & send` : "Tap to speak"}>
              {transcribing ? <Loader2 size={17} className="spin" /> : isRecording ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            {isRecording
              ? <span className="recording-badge"><span className="rec-dot" />{recSeconds}s — tap mic to send</span>
              : <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={transcribing ? "Transcribing…" : "What's been going on for you lately?"}
                  disabled={busy} />
            }

            <button type="button" className="send-button"
              onClick={() => sendMessage()} disabled={busy || isRecording || !input.trim()}>
              <Send size={17} />
            </button>
          </div>

          {voiceError && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.25rem", fontSize: "0.78rem", color: "var(--coral)" }}>
              <AlertTriangle size={13} />{voiceError}
              <button onClick={() => setVoiceError("")} style={{ marginLeft: "auto", color: "var(--muted)" }}><X size={13} /></button>
            </div>
          )}

          <a href="tel:0240961100" className="talk-to-person" style={{ textDecoration: "none" }}>
            <Phone size={13} /> Prefer to talk? Call the Evolve Hub on 02 4096 1100
          </a>
        </div>
      </div>

      {/* Crisis side panel */}
      {showCrisisPanel && (
        <aside className="crisis-side-panel" role="complementary">
          <div className="crisis-panel-header">
            <div>
              <p className="eyebrow" style={{ color: "#7a2317" }}>Support available now</p>
              <h3 className="crisis-panel-title">You're not alone</h3>
            </div>
            <button className="crisis-panel-dismiss" onClick={() => setShowCrisisPanel(false)}><X size={16} /></button>
          </div>
          <p className="crisis-panel-intro">Real people are available right now, 24 hours a day.</p>
          <div className="crisis-contact-list">
            {CRISIS_NUMBERS.map(c => (
              <a key={c.label} href={c.href} className={`crisis-contact-card${c.primary ? " primary" : ""}`}>
                <span className="crisis-contact-number">{c.label}</span>
                <span className="crisis-contact-desc">{c.description}</span>
              </a>
            ))}
          </div>
          <div className="crisis-panel-footer">
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>If you're in immediate physical danger, call 000 now.</span>
          </div>
        </aside>
      )}
    </section>
  );
}
