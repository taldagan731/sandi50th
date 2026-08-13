"use client";
import { HeroBeachMedia } from "@/components/HeroBeachMedia";

export function HeroVideoPreview() {
  return <section className="heroVideoPreview">
    <header><p>PRIVATE HERO REVIEW</p><h1>The finished beach motion</h1><span>Both use your animated photograph. Compare the natural wave motion by itself with a very gentle camera drift.</span></header>
    <div className="heroVideoChoices">
      <article><div className="heroVideoStage"><HeroBeachMedia priority /><div className="heroVideoScrim"/><div className="heroVideoTitle"><span>50</span><strong>Sandi Yadegari</strong><em>Still Becoming</em></div></div><h2>Wave motion only</h2><p>Recommended. Sandi and the camera stay steady while the water supplies the life.</p></article>
      <article><div className="heroVideoStage"><HeroBeachMedia drift /><div className="heroVideoScrim"/><div className="heroVideoTitle"><span>50</span><strong>Sandi Yadegari</strong><em>Still Becoming</em></div></div><h2>Waves + gentle drift</h2><p>The whole scene breathes very slightly. More cinematic, but the water motion is less pure.</p></article>
    </div>
    <p className="heroVideoFootnote">If this device requests reduced motion, these are deliberately still photographs and the video file is not requested.</p>
  </section>;
}