// In dev: Vite proxies /api → localhost:8000. In prod: same-origin.
const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

export const api = {
  referrals: () => request("/referrals"),
  createReferral: (payload) =>
    request("/referrals", { method: "POST", body: JSON.stringify(payload) }),
  updateReferral: (id, payload) =>
    request(`/referrals/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  caseInsights: (id) => request(`/referrals/${id}/insights`),
  chat: (payload) => request("/chat", { method: "POST", body: JSON.stringify(payload) }),
  analytics: () => request("/analytics"),
  programs: () => request("/programs"),
  staff: () => request("/staff"),
  createStaff: (payload) =>
    request("/staff", { method: "POST", body: JSON.stringify(payload) }),
  grantPermission: (staffId, payload) =>
    request(`/staff/${staffId}/permissions`, { method: "POST", body: JSON.stringify(payload) }),
  volunteers: () => request("/volunteers"),
};

export const riskLabel = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const statusColumns = [
  { key: "new", label: "New" },
  { key: "assigned", label: "Assigned" },
  { key: "contacted", label: "Contacted" },
  { key: "in_program", label: "In program" },
  { key: "follow_up", label: "Follow-up" },
];
