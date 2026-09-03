"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
const links = [["Plan", "/plan"], ["Marine Map", "/map"], ["Live Trip", "/trip"], ["About Data", "/about-data"]];
export function SiteHeader() { const path = usePathname(); return <header className="site-header"><nav aria-label="Primary" className="nav-inner"><Link href="/" className="brand"><BrandMark className="brand-mark" /><span>BLUEJURY <em>AI</em></span></Link><div className="nav-links">{links.map(([label, href]) => <Link key={href} href={href} className={path === href || path.startsWith(`${href}/`) ? "active" : ""}>{label}</Link>)}</div><span className="evidence-dot"><i /> Evidence connected</span></nav></header>; }
