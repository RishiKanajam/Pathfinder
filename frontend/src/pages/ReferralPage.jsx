import { useState } from "react";
import { CheckCircle2, ClipboardList, QrCode, ShieldCheck } from "lucide-react";
import { api } from "../lib/api.js";

const initialForm = {
  referrer_name: "",
  client_name: "",
  situation: "",
  referrer_contact: "",
  referrer_type: "friend",
  source_tag: "qr-community",
  urgency: "routine",
};

export default function ReferralPage() {
  const [mode, setMode] = useState("quick");
  const [form, setForm] = useState(initialForm);
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setCreated(null);
    try {
      const referral = await api.createReferral(form);
      setCreated(referral);
      setForm(initialForm);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="referral-layout">
      <div className="referral-copy">
        <p className="eyebrow">Partner referral portal</p>
        <h2>Capture the moment someone notices a person needs help.</h2>
        <p>
          Quick referral is built for phones, QR posters and informal community settings. Professional referral adds
          more context for GPs and agencies.
        </p>
        <div className="qr-tile">
          <QrCode size={94} />
          <div>
            <strong>Source tagged QR</strong>
            <span>qr-charlestown-gaming</span>
          </div>
        </div>
      </div>

      <form className="referral-form" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>
            Quick
          </button>
          <button type="button" className={mode === "pro" ? "active" : ""} onClick={() => setMode("pro")}>
            Professional
          </button>
        </div>

        <label>
          Your name
          <input value={form.referrer_name} onChange={(event) => update("referrer_name", event.target.value)} placeholder="Optional" />
        </label>

        <label>
          Their first name
          <input required value={form.client_name} onChange={(event) => update("client_name", event.target.value)} placeholder="First name" />
        </label>

        <label>
          What’s happening?
          <textarea required value={form.situation} onChange={(event) => update("situation", event.target.value)} placeholder="A few sentences is enough." />
        </label>

        <label>
          Your phone or email
          <input required value={form.referrer_contact} onChange={(event) => update("referrer_contact", event.target.value)} placeholder="For follow-up" />
        </label>

        {mode === "pro" && (
          <div className="pro-grid">
            <label>
              Referrer type
              <select value={form.referrer_type} onChange={(event) => update("referrer_type", event.target.value)}>
                <option value="gp">GP</option>
                <option value="agency">Agency</option>
                <option value="school">School</option>
                <option value="community_org">Community organisation</option>
              </select>
            </label>
            <label>
              Urgency
              <select value={form.urgency} onChange={(event) => update("urgency", event.target.value)}>
                <option value="routine">Routine</option>
                <option value="today">Needs contact today</option>
                <option value="urgent">Immediate concern</option>
              </select>
            </label>
          </div>
        )}

        <button className="primary-button" disabled={saving}>
          <ClipboardList size={18} />
          {saving ? "Creating referral..." : "Create referral"}
        </button>

        {created && (
          <div className={`confirmation ${created.risk_level}`}>
            <CheckCircle2 size={20} />
            <div>
              <strong>Referral #{created.id} created</strong>
              <span>
                AI triage marked this as {created.risk_level} risk and suggested staff follow-up.
              </span>
            </div>
          </div>
        )}

        <div className="safety-note">
          <ShieldCheck size={18} />
          PathFinder never replaces a human decision. Medium and high-risk referrals are surfaced for staff review.
        </div>
      </form>
    </section>
  );
}
