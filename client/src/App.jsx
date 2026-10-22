import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import NavPill from "./components/NavPill.jsx";
import LiquidGlassFilter from "./components/LiquidGlassFilter.jsx";
import Home from "./pages/Home.jsx";
import Listing from "./pages/Listing.jsx";
import Compare from "./pages/Compare.jsx";
import Submit from "./pages/Submit.jsx";
import Login from "./pages/Login.jsx";
import Admin from "./pages/Admin.jsx";
import HowWeMakeMoney from "./pages/HowWeMakeMoney.jsx";
import { api } from "./lib/api.js";

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
    <div className="min-h-screen bg-bg">
      <LiquidGlassFilter />
      <ScrollToTop />
      <NavPill me={me} onLogout={handleLogout} />
      <main className="pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listing/:slug" element={<Listing me={me} />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/submit" element={<Submit me={me} />} />
          <Route path="/login" element={<Login onLoggedIn={refreshMe} />} />
          <Route path="/admin" element={<Admin me={me} />} />
          <Route path="/how-we-make-money" element={<HowWeMakeMoney />} />
        </Routes>
      </main>
    </div>
  );
}
