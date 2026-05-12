import { useState } from "react";
import { ArrowLeft, MessageCircle, QrCode, TreePine, UsersRound } from "lucide-react";
import ChatPage from "./ChatPage.jsx";
import ReferralPage from "./ReferralPage.jsx";

const tabs = [
  { id: "chat",  label: "Chat with PathFinder", icon: MessageCircle },
  { id: "refer", label: "Refer someone",        icon: QrCode },
];

const CRISIS_CONTACTS = [
  { label: "000",            href: "tel:000",         urgent: true },
  { label: "Lifeline 13 11 14", href: "tel:131114" },
  { label: "NSW MH Line 1800 011 511", href: "tel:1800011511" },
  { label: "13YARN 13 92 76", href: "tel:139276" },
  { label: "Beyond Blue 1300 22 4636", href: "tel:1300224636" },
];

export default function PublicPortal({ onBack, onStaff }) {
  const [view, setView] = useState("chat");

  return (
    <div className="public-portal">
      {/* Crisis strip */}
      <div className="public-crisis-strip">
        <span style={{ fontWeight: 700, marginRight: "0.25rem" }}>In danger:</span>
        {CRISIS_CONTACTS.map((c) => (
          <a key={c.label} href={c.href} className={`pub-crisis-link${c.urgent ? " urgent" : ""}`}>
            {c.label}
          </a>
        ))}
        <a href="tel:0240961100" className="pub-crisis-link" style={{ marginLeft: "auto" }}>
          Evolve Hub 02 4096 1100
        </a>
      </div>

      {/* Header */}
      <header className="public-header">
        <div className="brand-lockup">
          <button
            className="back-button"
            onClick={onBack}
            aria-label="Back to home"
            title="Back to home"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="brand-mark" aria-hidden="true">
            <TreePine size={20} />
          </div>
          <div className="brand-name">
            <p className="eyebrow">LMNSPN · Evolve Hub</p>
            <h1 style={{ fontSize: "1.2rem" }}>PathFinder</h1>
          </div>
        </div>

        {/* Tab switcher */}
        <nav className="public-tabs" aria-label="Public navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab${view === tab.id ? " active" : ""}`}
                onClick={() => setView(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
          <button className="tab staff-access-tab" onClick={onStaff}>
            <UsersRound size={16} />
            Staff access
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="public-main">
        {view === "chat"  && <ChatPage />}
        {view === "refer" && <ReferralPage />}
      </main>
    </div>
  );
}
