import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import NavPill from "./components/NavPill.jsx";
import LiquidGlassFilter from "./components/LiquidGlassFilter.jsx";
import Home from "./pages/Home.jsx";
import Listing from "./pages/Listing.jsx";
import Compare from "./pages/Compare.jsx";
import Submit from "./pages/Submit.jsx";
import TestAgent from "./pages/TestAgent.jsx";
import Login from "./pages/Login.jsx";
import Admin from "./pages/Admin.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import RunPage from "./pages/RunPage.jsx";
import HeadToHead from "./pages/HeadToHead.jsx";
import Reports from "./pages/Reports.jsx";
import Directory from "./pages/Directory.jsx";
import HowWeMakeMoney from "./pages/HowWeMakeMoney.jsx";
import { api } from "./lib/api.js";
import { ThemeProvider } from "./lib/ThemeContext.jsx";
import ThemeTransitionOverlay from "./components/ThemeTransitionOverlay.jsx";
import TechyBackground from "./components/TechyBackground.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const [me, setMe] = useState(null);

  const refreshMe = useCallback(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const handleLogout = async () => {
    await api.logout();
    refreshMe();
  };

  return (
    <ThemeProvider>
      {/* No bg-bg here on purpose — html/body (index.css) already paint the
          page's solid base color. Keeping this wrapper transparent is what
          lets TechyBackground's fixed, fullscreen 3D canvas actually show
          through: an opaque background on this div would sit between the
          canvas and every page's content, hiding it completely regardless
          of z-index. */}
      <div className="min-h-screen">
        <TechyBackground />
        <LiquidGlassFilter />
        <ThemeTransitionOverlay />
        <ScrollToTop />
        <NavPill me={me} onLogout={handleLogout} />
        <main className="pb-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/listing/:slug" element={<Listing me={me} />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/runs/:kind/:id" element={<RunPage />} />
            <Route path="/head-to-head/:slugA/:slugB" element={<HeadToHead />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/directory" element={<Directory me={me} />} />
            <Route path="/submit" element={<Submit me={me} />} />
            <Route path="/test-agent" element={<TestAgent me={me} />} />
            <Route path="/login" element={<Login onLoggedIn={refreshMe} />} />
            <Route path="/owner" element={<OwnerDashboard me={me} setMe={setMe} />} />
            <Route path="/admin" element={<Admin me={me} />} />
            <Route path="/how-we-make-money" element={<HowWeMakeMoney />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}
