import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage.jsx";
import PublicPortal from "./pages/PublicPortal.jsx";
import StaffPortal  from "./pages/StaffPortal.jsx";

// Default: public chat. Staff go to ?portal=staff directly.
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initial =
    params.get("portal") === "staff"   ? "staff"   :
    params.get("portal") === "home"    ? "landing" :
    params.get("source")               ? "public"  : "public";

  const [view, setView] = useState(initial);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    // Deep-link support: ?portal=public, ?portal=staff, or ?portal=home
    if (params.get("portal") === "public") setView("public");
    if (params.get("portal") === "staff")  setView("staff");
    if (params.get("portal") === "home")   setView("landing");
    // QR code with ?source= always goes to public referral tab
    if (params.get("source")) setView("public");
    // Path-based routing
    if (path.includes("home"))   setView("landing");
    if (path.includes("staff"))  setView("staff");
    if (path.includes("portal")) setView("public");
  }, []);

  if (view === "public") return <PublicPortal onBack={() => setView("landing")} onStaff={() => setView("staff")} />;
  if (view === "staff")  return <StaffPortal  onBack={() => setView("landing")} />;
  return <LandingPage onPublic={() => setView("public")} onStaff={() => setView("staff")} />;
}
