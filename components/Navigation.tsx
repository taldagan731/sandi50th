import Link from "next/link";

export function Navigation() {
  return <header className="topbar"><div className="shell nav">
    <Link href="/" className="brand"><span className="mark">S</span><span><strong>Still Becoming</strong><small>The Story of Sandi</small></span></Link>
    <nav><Link href="/">Invitation</Link><Link href="/contribute">Contribute</Link><Link href="/studio">Story Studio</Link></nav>
  </div></header>;
}
