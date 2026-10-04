"use client";

import { useState } from "react";
import type { AccountProfile } from "@/lib/account/types";

interface AccountEnvelope {
  data?: AccountProfile;
  error?: { message?: string };
}

async function accountRequest(path: string, init?: RequestInit): Promise<AccountProfile> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({})) as AccountEnvelope;
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "SafeGo could not complete that request.");
  return payload.data;
}

export async function loadAccountSession(): Promise<AccountProfile | null> {
  const retryDelays = [0, 1_500, 3_000, 6_000];
  for (const delay of retryDelays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status === 401) return null;
      const payload = await response.json().catch(() => ({})) as AccountEnvelope;
      if (response.ok && payload.data) return payload.data;
    } catch {
      // The Java API may still be starting. Try again with a short backoff.
    }
  }
  return null;
}

export function AccountPanel({ open, account, onClose, onAccount }: {
  open: boolean;
  account: AccountProfile | null;
  onClose: () => void;
  onAccount: (account: AccountProfile | null) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(account?.email ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [password, setPassword] = useState("");
  const [home, setHome] = useState(account?.home ?? "");
  const [school, setSchool] = useState(account?.school ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  if (!open) return null;

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const profile = await accountRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, name, password }),
      });
      onAccount(profile);
      setHome(profile.home);
      setSchool(profile.school);
      setPassword("");
      setMessage(mode === "register" ? "Your SafeGo account is ready." : "Signed in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setWorking(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const profile = await accountRequest("/api/account/places", {
        method: "PUT",
        body: JSON.stringify({ home, school }),
      });
      onAccount(profile);
      setMessage("Saved places updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your places.");
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    setWorking(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      onAccount(null);
      onClose();
    }
  }

  return <div className="account-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <div className="account-head"><div><span>SafeGo account</span><h2 id="account-title">{account ? "Your saved places" : mode === "login" ? "Welcome back" : "Create your account"}</h2></div><button type="button" onClick={onClose} aria-label="Close account panel">×</button></div>
      {!account ? <>
        <div className="account-mode-tabs" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
        </div>
        <form className="account-form" onSubmit={authenticate}>
          <p>Save Home and School so they are ready whenever you check an area or route.</p>
          <label htmlFor="account-email">Email</label><input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" maxLength={254} />
          {mode === "register" && <><label htmlFor="account-name">Name</label><input id="account-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" placeholder="How should SafeGo address you?" /></>}
          <label htmlFor="account-password">Password</label><input id="account-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && <p className="account-field-help">Use at least 10 characters with a letter and a number.</p>}
          <button className="submit-btn" type="submit" disabled={working}>{working ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
          {error && <div className="account-message error" role="alert">{error}</div>}
        </form>
      </> : <form className="account-form" onSubmit={save}>
        <div className="account-identity"><strong>{account.name}</strong><span>{account.email}</span></div>
        <label htmlFor="account-home">Home</label><input id="account-home" value={home} onChange={(event) => setHome(event.target.value)} maxLength={160} placeholder="Address, area, or landmark" />
        <p className="account-field-help">Home becomes the suggested destination when you add one.</p>
        <label htmlFor="account-school">School</label><input id="account-school" value={school} onChange={(event) => setSchool(event.target.value)} maxLength={160} placeholder="Campus or university" />
        <div className="account-actions"><button className="submit-btn" type="submit" disabled={working}>{working ? "Saving…" : "Save places"}</button><button className="account-signout" type="button" onClick={() => void signOut()} disabled={working}>Sign out</button></div>
        {message && <div className="account-message" role="status">{message}</div>}
        {error && <div className="account-message error" role="alert">{error}</div>}
        <small>{account.persistence === "database" ? "Saved places are stored in your SafeGo account." : "This local account lasts until the Java server restarts. Connect the database for persistence."}</small>
      </form>}
    </section>
  </div>;
}
