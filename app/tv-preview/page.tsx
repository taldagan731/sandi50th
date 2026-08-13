import { SeventiesTelevision } from "../../components/SeventiesTelevision";
import "../reveal/birth-week-experience.css";
import "../reveal/birth-week-luxury-pass.css";
import "../reveal/birth-week-print-brand-pass.css";
import "../reveal/birth-week-teal-tv-pass.css";
import "../reveal/birth-week-tps-l2-pass.css";
import "../reveal/birth-week-real-tv-pass.css";
import "../reveal/birth-week-photoreal-pass.css";
import "../reveal/birth-week-photographic-tv.css";
import "../reveal/birth-week-ge-tv.css";
import "../reveal/birth-week-embed-safety.css";

export default function TelevisionPreviewPage() {
  return (
    <main style={{ minHeight: "100dvh", padding: "clamp(1rem, 4vw, 4rem)", color: "#fff8ef", background: "radial-gradient(circle at 25% 0, #9d2c68, transparent 40%), linear-gradient(145deg, #5a183e, #241020)" }}>
      <div className="birthWeekExperience">
        <SeventiesTelevision />
      </div>
    </main>
  );
}
