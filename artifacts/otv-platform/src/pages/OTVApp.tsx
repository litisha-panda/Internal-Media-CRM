// @ts-nocheck
import React, { useState, useEffect } from "react";
import { setSessionToken as setSessionTokenLib } from "../services/api/_client";
import * as authSvc from "../services/api/auth";
import { CROApp } from "./CROApp";
import { LoginScreen } from "../views/auth/LoginScreen";
import { HomeScreen } from "../views/auth/HomeScreen";

function setSessionTokenStore(t) {
  setSessionTokenLib(t);
}

export default function OTVApp() {
  const [loggedIn, setLoggedIn]               = useState(false);
  const [loginUser, setLoginUser]             = useState(null);
  const [section, setSection]                 = useState("home");
  const [sessionChecking, setSessionChecking] = useState(true);

  // On mount: restore session from stored token (localStorage) or cookie
  useEffect(() => {
    authSvc.getMe()
      .then(data => {
        if (data?.ok && data.user) {
          setLoginUser(data.user);
          setLoggedIn(true);
          setSection("crm");
        } else {
          setSessionTokenStore(null);
        }
      })
      .catch(() => {})
      .finally(() => setSessionChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (user) => {
    // Clear entity localStorage caches on every fresh login so API data always wins
    ["otv_deals","otv_tasks","otv_internalReqs","otv_targetSubs",
     "otv_revenueEntries","otv_clientAccounts","otv_touchpoints"
    ].forEach(k => { try { localStorage.removeItem(k); } catch {} });
    setLoginUser(user);
    setLoggedIn(true);
    setSection("crm");
  };

  const handleLogout = () => {
    authSvc.logout().catch(() => {});
    setSessionTokenStore(null);
    setLoggedIn(false);
    setLoginUser(null);
    setSection("home");
  };

  // Session expiry: any API 401 dispatches "otv:unauthorized"
  useEffect(() => {
    const onUnauth = () => handleLogout();
    window.addEventListener("otv:unauthorized", onUnauth);
    return () => window.removeEventListener("otv:unauthorized", onUnauth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (s) => setSection(s);
  const handleBack   = ()  => setSection("home");

  // While checking session — show neutral loader, never flash the login screen
  if (sessionChecking) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f0f4f9"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8a97ae",letterSpacing:".08em"}}>OTV CRM</div>
    </div>
  );

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
  if (section === "home") return <HomeScreen user={loginUser} onSelect={handleSelect} onLogout={handleLogout} />;

  return (
    <CROApp
      key={loginUser?.email || loginUser?.id}
      user={loginUser}
      onLogout={handleLogout}
      section={section}
      onGoHome={handleBack}
    />
  );
}
