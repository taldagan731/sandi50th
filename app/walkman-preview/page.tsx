import { TimelineJukebox } from "@/components/TimelineJukebox";
import "../reveal/birth-week-experience.css";
import "../reveal/birth-week-luxury-pass.css";
import "../reveal/birth-week-print-brand-pass.css";
import "../reveal/birth-week-walkman-pass.css";
import "../reveal/birth-week-tps-l2-pass.css";
import "../reveal/birth-week-photoreal-pass.css";
import "../reveal/birth-week-cassette-mechanism.css";
import "../reveal/birth-week-matched-walkman.css";

import "./walkman-preview.css";

export default function WalkmanPreviewPage() {
  return (
    <main className="walkmanPreviewPage">
      <header><span>LOCAL REVIEW · NOT DEPLOYED</span><h1>Walkman cassette mechanism</h1><p>Press PLAY to insert the presented cassette. Press EJECT to open the door, lift the current tape, present the next label, insert it, and close the door.</p></header>
      <div className="birthWeekExperience"><TimelineJukebox forceMotion /></div>
    </main>
  );
}



