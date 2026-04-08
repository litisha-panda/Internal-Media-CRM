import React, { useState, useEffect } from "react";
import { setSessionToken as setSessionTokenLib } from "../services/api/_client";
import * as authSvc from "../services/api/auth";
import type { ApiUser } from "../services/api/auth";
import { CROApp } from "./CROApp";
import { LoginScreen } from "../views/auth/LoginScreen";

function setSessionTokenStore(t: string | null): void {
  setSessionTokenLib(t);
}

export default function OTVApp() {
  const [loggedIn, setLoggedIn]               = useState(false);
  const [loginUser, setLoginUser]             = useState<ApiUser | null>(null);
  const [sessionChecking, setSessionChecking] = useState(true);

  useEffect(() => {
    authSvc.getMe()
      .then((data) => {
        if (data?.ok && data.user) {
          setLoginUser(data.user);
          setLoggedIn(true);
        } else {
          setSessionTokenStore(null);
        }
      })
      .catch(() => {})
      .finally(() => setSessionChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (user: ApiUser) => {
    ["otv_deals","otv_tasks","otv_internalReqs","otv_targetSubs",
     "otv_revenueEntries","otv_clientAccounts","otv_touchpoints"
    ].forEach(k => { try { localStorage.removeItem(k); } catch {} });
    setLoginUser(user);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    authSvc.logout().catch(() => {});
    setSessionTokenStore(null);
    setLoggedIn(false);
    setLoginUser(null);
  };

  useEffect(() => {
    const onUnauth = () => handleLogout();
    window.addEventListener("otv:unauthorized", onUnauth);
    return () => window.removeEventListener("otv:unauthorized", onUnauth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sessionChecking) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f0f4f9"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8a97ae",letterSpacing:".08em"}}>OTV CRM</div>
    </div>
  );

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  return (
    <CROApp
      key={loginUser?.email || String(loginUser?.id ?? "")}
      user={loginUser}
      onLogout={handleLogout}
    />
  );
}
