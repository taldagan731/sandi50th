"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SearchResult = { id: string; kind: "chapter" | "text" | "photo" | "media"; title: string; detail: string; href: string };
const LABELS = { chapter: "Chapter", text: "Writing", photo: "Photo", media: "Media" } as const;

export function GlobalSiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("Search memories, descriptions, and people.");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); setStatus("Type at least two letters."); return; }
    const controller = new AbortController();
    setStatus("Searching Sandi’s story…");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (response.status === 403) { setResults([]); setStatus("The reveal must be open on this device before its private contents can be searched."); return; }
        if (!response.ok) throw new Error("Search unavailable");
        const next = (body.results ?? []) as SearchResult[];
        setResults(next);
        setStatus(next.length ? `${next.length} result${next.length === 1 ? "" : "s"}` : "No matching memories or photographs yet.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setResults([]); setStatus("Search needs another moment. Please try again."); }
      }
    }, 260);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <>
      <button type="button" className="globalSearchTrigger" aria-label="Search Sandi’s story" aria-expanded={open} onClick={() => setOpen(true)}><span aria-hidden="true">⌕</span><strong>Search</strong></button>
      {open && (
        <div className="globalSearchBackdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="globalSearchDialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
            <header><div><span>FIND IT IN HER STORY</span><h2 id="global-search-title">Search memories and photographs</h2></div><button type="button" aria-label="Close search" onClick={() => setOpen(false)}>×</button></header>
            <label className="globalSearchField"><span aria-hidden="true">⌕</span><input ref={inputRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try a person, place, phrase, or photograph…" autoComplete="off" /></label>
            <p className="globalSearchStatus" aria-live="polite">{status}</p>
            <div className="globalSearchResults">{results.map(result => <Link key={result.id} href={result.href} onClick={() => setOpen(false)}><span>{LABELS[result.kind]}</span><strong>{result.title}</strong><small>{result.detail}</small></Link>)}</div>
          </section>
        </div>
      )}
    </>
  );
}
