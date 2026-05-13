import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bot, ExternalLink,
  Loader2, Mic, Phone, Send, UserRound, X,
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

function StreamCursor() {
  return <span className="stream-cursor">▍</span>;
}

// Animated waveform bars for voice mode
function VoiceBars({ state, amplitude }) {
  const bars = 7;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 32 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const center = (bars - 1) / 2;
        const dist = Math.abs(i - center);
        const baseH = state === "listening"
          ? 6 + amplitude * 28 * Math.max(0, 1 - dist * 0.25)
          : state === "speaking" ? 14 - dist * 2 : 4;
        return (
          <div key={i} style={{
            width: 3, borderRadius: 2, background: "white",
            height: Math.max(4, baseH),
            opacity: state === "thinking" ? 0.4 : 1,
            transition: "height 0.08s ease",
            animation: state === "thinking" ? "none" : `voiceBarBounce 0.5s ${i * 0.07}s ease-in-out infinite alternate`,
          }} />
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages]               = useState([OPENING_MSG]);
  const [input, setInput]                     = useState("");
  const [conversationId, setCid]              = useState(null);
  const [streaming, setStreaming]             = useState(false);
  const [afterHours, setAfterHours]           = useState(false);
  const [showCrisisPanel, setShowCrisisPanel] = useState(false);
  const [programMatches, setProgramMatches]   = useState([]);
  const [voiceError, setVoiceError]           = useState("");

  // Voice mode
  const [voiceMode, setVoiceMode]       = useState(false);
  const [voiceState, setVoiceState]     = useState("idle"); // listening | thinking | speaking
  const [amplitude, setAmplitude]       = useState(0);

  const endRef         = useRef(null);
  const inputRef       = useRef(null);
  const convIdRef      = useRef(null);
  const voiceModeRef   = useRef(false);
  const streamRef      = useRef(null);
  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const vadRef         = useRef(null);
  const audioCtxRef    = useRef(null);
  const currentAudio   = useRef(null);
  const accumulatedRef = useRef("");
  const listeningRef   = useRef(false); // prevent re-entrant cycles
  const maxTimerRef    = useRef(null);  // 20s hard stop

  useEffect(() => { convIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  useEffect(() => {
    setAfterHours(new Date().getHours() < 9 || new Date().getHours() >= 17);
    return () => stopVoiceResources();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── Send with streaming ────────────────────────────────────

  async function sendMessage(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    if (!textOverride) setInput("");
    accumulatedRef.current = "";

    const userMsg = { role: "client", content: text, ts: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setStreaming(true);

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
              accumulatedRef.current += parsed.delta;
              const snap = accumulatedRef.current;
              setMessages(m => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last?.streaming) copy[copy.length - 1] = { ...last, content: snap };
                return copy;
              });
            }
            if (parsed.meta) {
              if (parsed.meta.risk?.level === "high") setShowCrisisPanel(true);
              if (parsed.meta.matches?.length) setProgramMatches(parsed.meta.matches.slice(0, 3));
            }
            if (parsed.conv_id) setCid(parsed.conv_id);
          } catch {}
        }
      }

      setMessages(m => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.streaming) copy[copy.length - 1] = { ...last, streaming: false };
        return copy;
      });

      // Speak the reply if in voice mode
      if (voiceModeRef.current && accumulatedRef.current.trim()) {
        await speakReply(accumulatedRef.current.trim());
      }

    } catch {
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
      if (voiceModeRef.current) await startListeningCycle();
    } finally {
      setStreaming(false);
      if (!voiceModeRef.current) inputRef.current?.focus();
    }
  }

  // ── Voice mode ─────────────────────────────────────────────

  function stopVoiceResources() {
    listeningRef.current = false;
    clearInterval(vadRef.current);
    clearTimeout(maxTimerRef.current);
    try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    currentAudio.current?.pause();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  // Manual stop — user taps "Send now" button in voice mode
  function manualStopListening() {
    if (recorderRef.current?.state === "recording") {
      clearInterval(vadRef.current);
      clearTimeout(maxTimerRef.current);
      recorderRef.current.stop();
    }
  }

  async function enterVoiceMode() {
    setVoiceError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone not supported in this browser.");
      return;
    }
    setVoiceMode(true);
    voiceModeRef.current = true;
    await startListeningCycle();
  }

  function exitVoiceMode() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    setVoiceState("idle");
    setAmplitude(0);
    stopVoiceResources();
  }

  async function startListeningCycle() {
    if (!voiceModeRef.current || listeningRef.current) return;
    listeningRef.current = true;
    clearInterval(vadRef.current);
    clearTimeout(maxTimerRef.current);
    try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setVoiceState("listening");
    setAmplitude(0);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
    } catch {
      exitVoiceMode();
      setVoiceError("Microphone access denied.");
      return;
    }
    streamRef.current = stream;

    // AudioContext for VAD
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    // Recorder
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find(t => MediaRecorder.isTypeSupported(t)) || "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    recorder.onstop = async () => {
      listeningRef.current = false;
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close().catch(() => {});
      if (!voiceModeRef.current) return;
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      if (blob.size < 800) { await startListeningCycle(); return; }
      setVoiceState("thinking");
      await transcribeAndSend(blob, mimeType);
    };

    recorder.start(100);

    // Resume AudioContext — required on some browsers after user gesture
    if (audioCtx.state === "suspended") await audioCtx.resume();

    // 25s hard-stop so it never gets stuck listening forever
    maxTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 25000);

    // VAD — use frequency domain (much more reliable for speech than time domain RMS)
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const SPEECH_THRESHOLD = 20;  // 0–255 frequency average; speech ~30+, silence ~5–15
    const SILENCE_MS = 1200;
    let hasSpeech = false;
    let lastSpeech = Date.now();

    vadRef.current = setInterval(() => {
      if (!voiceModeRef.current) { clearInterval(vadRef.current); return; }
      analyser.getByteFrequencyData(freqData);
      // Average energy across speech-relevant frequency bands (300Hz–3400Hz)
      const binStart = Math.floor(300  / (audioCtx.sampleRate / analyser.fftSize));
      const binEnd   = Math.floor(3400 / (audioCtx.sampleRate / analyser.fftSize));
      let sum = 0;
      for (let i = binStart; i <= Math.min(binEnd, freqData.length - 1); i++) sum += freqData[i];
      const energy = sum / Math.max(binEnd - binStart, 1);

      setAmplitude(Math.min(energy / 60, 1)); // 0–1 for animation

      if (energy > SPEECH_THRESHOLD) {
        hasSpeech = true;
        lastSpeech = Date.now();
      } else if (hasSpeech && Date.now() - lastSpeech > SILENCE_MS) {
        clearInterval(vadRef.current);
        clearTimeout(maxTimerRef.current);
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }
    }, 80);
  }

  async function transcribeAndSend(blob, mimeType) {
    try {
      const res = await fetch(`${API}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": mimeType || "audio/webm" },
        body: blob,
      });
      const data = await res.json();
      if (data.text?.trim()) {
        await sendMessage(data.text.trim());
      } else {
        await startListeningCycle();
      }
    } catch {
      if (voiceModeRef.current) await startListeningCycle();
    }
  }

  async function speakReply(text) {
    if (!voiceModeRef.current) return;
    setVoiceState("speaking");
    try {
      const res = await fetch(`${API}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio.current = audio;
      await new Promise(resolve => { audio.onended = resolve; audio.onerror = resolve; audio.play().catch(resolve); });
      URL.revokeObjectURL(url);
    } catch { /* skip TTS, continue */ }
    if (voiceModeRef.current) await startListeningCycle();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const busy = streaming;

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
          {/* Voice transcribing indicator — shows in message list between turns */}
          {voiceMode && voiceState === "thinking" && (
            <div className="message-row ai">
              <div className="avatar ai-avatar"><Loader2 size={16} className="spin" /></div>
              <div>
                <div className="message-bubble" style={{ background: "rgba(45,106,79,0.06)", color: "var(--muted)", fontSize: "0.82rem" }}>
                  Transcribing your message…
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

        {/* Composer / Voice UI */}
        <div className="chat-composer" style={voiceMode ? { paddingTop: "0.5rem" } : {}}>
          {voiceMode ? (
            /* ── Voice mode UI ── */
            <div className="voice-mode-panel" style={{ paddingTop: "0.75rem", paddingBottom: "0.25rem" }}>
              <div className={`voice-orb voice-orb-${voiceState}`}>
                <VoiceBars state={voiceState} amplitude={amplitude} />
              </div>
              <p className="voice-state-label">
                {voiceState === "listening" ? "Listening…"
                  : voiceState === "thinking" ? "Thinking…"
                  : "Speaking…"}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                {voiceState === "listening" && (
                  <button className="primary-button" style={{ fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}
                    onClick={manualStopListening}>
                    Send now
                  </button>
                )}
                {voiceState === "speaking" && (
                  <button className="quiet-button" style={{ fontSize: "0.8rem" }}
                    onClick={() => { currentAudio.current?.pause(); startListeningCycle(); }}>
                    Interrupt
                  </button>
                )}
                <button className="quiet-button" style={{ fontSize: "0.8rem", color: "var(--coral)" }}
                  onClick={exitVoiceMode}>
                  End voice chat
                </button>
              </div>
            </div>
          ) : (
            /* ── Text input ── */
            <>
              <div className="composer-input-row">
                <button type="button" className="mic-button"
                  onClick={enterVoiceMode}
                  title="Switch to voice chat">
                  <Mic size={17} />
                </button>
                <input ref={inputRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What's been going on for you lately?"
                  disabled={busy} />
                <button type="button" className="send-button"
                  onClick={() => sendMessage()} disabled={busy || !input.trim()}>
                  {busy ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
                </button>
              </div>
              {voiceError && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.25rem", fontSize: "0.78rem", color: "var(--coral)" }}>
                  <AlertTriangle size={13} />{voiceError}
                  <button onClick={() => setVoiceError("")} style={{ marginLeft: "auto", color: "var(--muted)" }}><X size={13} /></button>
                </div>
              )}
            </>
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
