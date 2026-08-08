import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShaderPalettePreview } from "@/components/ShaderPalettePreview";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import "./shader-preview.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private flowing-cloud color review", robots: { index: false, follow: false, noarchive: true } };

export default async function ShaderPreviewPage() {
  if (!await hasRevealPreviewAccess()) notFound();
  return <main className="shaderPreviewPage"><ShaderPalettePreview /></main>;
}
