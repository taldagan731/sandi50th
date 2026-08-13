"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type FormStatus = "idle" | "sending" | "sent" | "error";

export function GlobalHelpRequest() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => nameRef.current?.focus(), 30);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function show() {
    setStatus("idle");
    setMessage("");
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage("Sending your note to Tal…");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/help-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          problem: data.get("problem"),
          website: data.get("website"),
          page: window.location.href
        })
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Your message could not be sent.");
      form.reset();
      setStatus("sent");
      setMessage("Your message reached Tal. He can contact you at the email you provided.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Your message could not be sent. Please try again.");
    }
  }

  return (
    <>
      <button className="globalHelpTrigger" type="button" aria-label="Need help? Ask Tal for help" aria-expanded={open} onClick={show}>
        <span aria-hidden="true">?</span><strong>Need help?</strong>
      </button>
      {open && (
        <div className="globalHelpBackdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="globalHelpDialog" role="dialog" aria-modal="true" aria-labelledby="global-help-title">
            <header>
              <div><span>HAVING A PROBLEM?</span><h2 id="global-help-title">Ask Tal for help</h2></div>
              <button type="button" aria-label="Close help form" onClick={() => setOpen(false)}>&times;</button>
            </header>
            <p>Tell Tal what happened and how to reach you. He will receive your message by email.</p>
            <form onSubmit={submit}>
              <label>Your name <strong>Required</strong><input ref={nameRef} name="name" required maxLength={100} autoComplete="name" /></label>
              <label>Your email <strong>Required</strong><input name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" /></label>
              <label>What went wrong? <strong>Required</strong><textarea name="problem" required minLength={5} maxLength={3000} rows={5} placeholder="For example: I recorded a message, but it did not finish sending." /></label>
              <label className="globalHelpHoneypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <button className="globalHelpSend" type="submit" disabled={status === "sending" || status === "sent"}>{status === "sending" ? "Sending…" : status === "sent" ? "Message sent" : "Send to Tal"}</button>
              <p className={`globalHelpStatus globalHelpStatus--${status}`} role="status" aria-live="polite">{message}</p>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
