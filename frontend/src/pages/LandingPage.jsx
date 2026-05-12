import { ArrowRight, Heart, MessageCircle, Shield, TreePine, Users } from "lucide-react";

const CRISIS_CONTACTS = [
  { label: "Lifeline", number: "13 11 14", href: "tel:131114" },
  { label: "000",       number: "Emergency",  href: "tel:000" },
  { label: "13YARN",   number: "13 92 76",   href: "tel:139276" },
];

export default function LandingPage({ onPublic, onStaff }) {
  return (
    <div className="landing">
      {/* Crisis strip — always top */}
      <div className="landing-crisis-strip">
        <span>If you're in immediate danger:</span>
        {CRISIS_CONTACTS.map((c) => (
          <a key={c.label} href={c.href} className="landing-crisis-link">
            {c.label} <strong>{c.number}</strong>
          </a>
        ))}
      </div>

      <div className="landing-body">
        {/* Left — Hero copy */}
        <div className="landing-hero">
          <div className="landing-brand">
            <div className="landing-brand-mark">
              <TreePine size={28} />
            </div>
            <div>
              <p className="eyebrow">LMNSPN · Evolve Mental Health &amp; Wellbeing Hub</p>
              <h1 className="landing-title">PathFinder</h1>
            </div>
          </div>

          <p className="landing-tagline">
            The intelligent front door to mental health support<br />
            in the Hunter Region — available 24 hours, 7 days.
          </p>

          <p className="landing-sub">
            PathFinder listens, understands, and connects people to the right program
            at the Evolve Hub. It captures every referral for the first time in 14 years —
            so no one falls through the cracks.
          </p>

          <div className="landing-stats">
            <div className="landing-stat">
              <strong>14 programs</strong>
              <span>Connected to Care partners</span>
            </div>
            <div className="landing-stat">
              <strong>24 / 7</strong>
              <span>Intake, even after hours</span>
            </div>
            <div className="landing-stat">
              <strong>14 years</strong>
              <span>LMNSPN serving the Hunter</span>
            </div>
          </div>

          <div className="landing-pillars">
            {[
              { icon: MessageCircle, label: "AI-powered chat and voice intake" },
              { icon: Shield,        label: "Multi-layer risk assessment, always on" },
              { icon: Users,         label: "Live staff dashboard and analytics" },
              { icon: Heart,         label: "Routes to verified Hub partners only" },
            ].map(({ icon: Icon, label }) => (
              <div className="landing-pillar" key={label}>
                <Icon size={16} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Portal cards */}
        <div className="landing-portals">
          {/* Public portal */}
          <button className="portal-card portal-public" onClick={onPublic}>
            <div className="portal-card-icon">
              <MessageCircle size={36} />
            </div>
            <div className="portal-card-body">
              <h2>I need support</h2>
              <p>
                Chat or speak with PathFinder. Share what's happening and we'll
                help find the right support — confidentially, at your pace.
              </p>
              <ul className="portal-card-features">
                <li>Text and voice intake</li>
                <li>Matched to Evolve Hub partners</li>
                <li>Available right now, day or night</li>
                <li>Refer someone you're worried about</li>
              </ul>
            </div>
            <div className="portal-card-cta">
              Get started <ArrowRight size={18} />
            </div>
          </button>

          {/* Staff portal */}
          <button className="portal-card portal-staff" onClick={onStaff}>
            <div className="portal-card-icon">
              <Users size={36} />
            </div>
            <div className="portal-card-body">
              <h2>Staff &amp; Volunteers</h2>
              <p>
                Manage referrals, view case insights, monitor risk in real time,
                and run analytics for grant reporting.
              </p>
              <ul className="portal-card-features">
                <li>Referral pipeline with AI triage</li>
                <li>Case complexity and fit scoring</li>
                <li>Live escalation monitor</li>
                <li>Hunter Region heatmap &amp; reports</li>
              </ul>
            </div>
            <div className="portal-card-cta">
              Staff access <ArrowRight size={18} />
            </div>
          </button>

          <p className="landing-footer-note">
            Evolve Hub · 54 Ridley Street, Charlestown NSW 2290 ·{" "}
            <a href="tel:0240961100">02 4096 1100</a> ·{" "}
            <a href="https://www.connectedtocare.com.au" target="_blank" rel="noopener noreferrer">
              connectedtocare.com.au
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
