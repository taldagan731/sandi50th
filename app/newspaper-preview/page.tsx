import { RoslynHerald } from "../../components/RoslynHerald";

export default function NewspaperPreviewPage() {
  return (
    <main style={{ minHeight: "100dvh", padding: "clamp(1rem, 4vw, 4rem)", color: "#fff8ef", background: "radial-gradient(circle at 20% 0, #a03269, transparent 42%), linear-gradient(145deg, #59173f, #241020)" }}>
      <div style={{ width: "min(82rem, 100%)", margin: "0 auto" }}>
        <RoslynHerald />
      </div>
    </main>
  );
}
