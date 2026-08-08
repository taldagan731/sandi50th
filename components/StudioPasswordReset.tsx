"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function StudioPasswordReset() {
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 12) return setError("Use at least 12 characters.");
    if (password !== confirmation) return setError("The two passwords do not match.");

    setWorking(true);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setWorking(false);
      return;
    }
    await supabase.auth.signOut();
    setComplete(true);
    setWorking(false);
  }

  if (complete) return (
    <section className="studioGate">
      <div className="studioRecoveryCard">
        <span className="eyebrow">PASSWORD SET</span>
        <h1>Your Studio password is ready.</h1>
        <p>Sign in with the same email address and the password you just chose.</p>
        <Link className="primary" href="/studio">Return to Story Studio</Link>
      </div>
    </section>
  );

  return (
    <section className="studioGate">
      <form onSubmit={updatePassword}>
        <span className="eyebrow">PRIVATE STORY STUDIO</span>
        <h1>Set your password.</h1>
        <p>{ready ? "Choose a strong password you can use reliably on Tuesday." : "Open this page from the password email. If the link expired, request a fresh one from Story Studio."}</p>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required disabled={!ready} /></label>
        <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required disabled={!ready} /></label>
        {error && <p className="studioError" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={!ready || working}>{working ? "Saving…" : "Save password"}</button>
        <Link className="secondary" href="/studio">Back to sign in</Link>
      </form>
    </section>
  );
}
