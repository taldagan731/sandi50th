"use client";

import Image from "next/image";
import { useState } from "react";
import { FlowingCloudShader, type CloudPalette } from "@/components/FlowingCloudShader";
import { ShaderPerformanceMeter } from "@/components/ShaderPerformanceMeter";

const choices: Array<{ id: CloudPalette; title: string; description: string }> = [
  { id: "coral", title: "Bright Coral Sky", description: "The happiest and warmest: vivid coral clouds, raspberry pink and peach light." },
  { id: "magenta", title: "Electric Rose", description: "The boldest: saturated magenta and periwinkle over a deep berry ground." },
  { id: "champagne", title: "Pink Champagne", description: "Still bright, with warmer rose, coral and celebratory champagne highlights." }
];

export function ShaderPalettePreview() {
  const [selected, setSelected] = useState<CloudPalette>("coral");
  const active = choices.find(choice => choice.id === selected)!;
  return (
    <section className="shaderComparison" aria-labelledby="shader-preview-title">
      <div className="shaderStage">
        <FlowingCloudShader palette={selected} />
        <Image className="shaderPreviewPhoto" src="/images/sandi-hero.jpeg" alt="Sandi standing in the ocean at the beach" fill priority sizes="(max-width: 760px) 100vw, 1120px" />
        <div className="shaderPhotoWash" />
        <div className="shaderSampleCopy">
          <span>STILL BECOMING</span>
          <h1>Sandi</h1>
          <p>The way we see you.</p>
        </div>
      </div>
      <div className="shaderChoices" role="radiogroup" aria-label="Flowing cloud color variations">
        {choices.map(choice => (
          <button key={choice.id} type="button" role="radio" aria-checked={selected === choice.id} className={`shaderChoice palette-${choice.id}`} onClick={() => setSelected(choice.id)}>
            <i aria-hidden="true" />
            <strong>{choice.title}</strong>
            <span>{choice.description}</span>
          </button>
        ))}
      </div>
      <ShaderPerformanceMeter sampleKey={selected} />
      <p className="shaderSelection"><strong>Selected:</strong> {active.title}. This page is comparison-only; none is wired into the live hero or reveal yet.</p>
    </section>
  );
}
