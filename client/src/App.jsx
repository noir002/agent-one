import { useEffect, useState, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import Home from "./pages/Home.jsx";
import Agent from "./pages/Agent.jsx";
import Grove from "./pages/Grove.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import SharedRun from "./pages/SharedRun.jsx";
import DevLogin from "./pages/DevLogin.jsx";
import Upload from "./pages/Upload.jsx";
import { api } from "./lib/api.js";

export default function App() {
  const [me, setMe] = useState(null);

  const refreshMe = useCallback(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const handleLogout = async () => {
    await api.logout();
    refreshMe();
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl">
      <Nav me={me} onLogout={handleLogout} />
      <main className="px-4 pb-16 sm:px-8">
        <Routes>
          <Route path="/" element={<Home me={me} />} />
          <Route path="/grove/:grove" element={<Grove />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/agent/:slug" element={<Agent me={me} onRan={refreshMe} />} />
          <Route path="/r/:shareId" element={<SharedRun />} />
          <Route path="/login" element={<DevLogin onLoggedIn={refreshMe} />} />
          <Route path="/upload" element={<Upload me={me} />} />
        </Routes>
      </main>
    </div>
  );
}
