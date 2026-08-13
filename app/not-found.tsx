import Link from "next/link";

export default function NotFound() {
  return (
    <main className="brandedNotFound">
      <span className="eyebrow">STILL BECOMING</span>
      <h1>This page wandered out of the story.</h1>
      <p>The celebration is still here.</p>
      <div className="actions">
        <Link className="primary" href="/reveal">Return to Sandi&rsquo;s story</Link>
        <Link className="secondary" href="/contribute">Share something for Sandi</Link>
      </div>
    </main>
  );
}
