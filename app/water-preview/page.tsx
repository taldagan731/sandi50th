import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeroVideoPreview } from "@/components/HeroVideoPreview";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import "./water-preview.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private beach-water motion review", robots: { index: false, follow: false, noarchive: true } };

export default async function WaterPreviewPage(){
  if(!await hasRevealPreviewAccess())notFound();
  return <main className="waterPreviewPage"><HeroVideoPreview/></main>;
}
