"use client";
import { useState } from "react";
import { Navigation } from "@/components/Navigation";

export default function Contribute() {
  const [started,setStarted] = useState(false);
  const [memory,setMemory] = useState("");
  return <main><Navigation/><section className="section pageTop"><div className="shell narrow">
    <div className="sectionTitle"><span className="eyebrow">HELP TELL SANDI’S STORY</span><h2>Preserve a memory that deserves to live forever.</h2><p>Please submit by August 7, 2026.</p></div>
    <div className="panel form">
      <label>When you think of Sandi, what is the first memory that comes to mind?<textarea rows={6} value={memory} onChange={e=>setMemory(e.target.value)} placeholder="Begin with the story—not the file."/></label>
      {!started ? <button className="primary" disabled={!memory.trim()} onClick={()=>setStarted(true)}>Continue the story</button> : <>
        <div className="grid2"><label>Your name<input required/></label><label>Email or phone<input required/></label></div>
        <div className="grid2"><label>Your relationship<select><option>Family</option><option>Friend</option><option>Childhood friend</option><option>Colleague</option><option>Other</option></select></label><label>Approximate year<input placeholder="1988 or early 1990s"/></label></div>
        <label>Who appears in the memory?<input placeholder="Names, if known"/></label>
        <label>Life chapter<select><option>Baby and early childhood</option><option>Growing up in Roslyn</option><option>School years</option><option>Boston University</option><option>England abroad</option><option>Career and Oracle</option><option>Family and love</option><option>Travel</option><option>Friendships</option><option>Today</option></select></label>
        <label>The story behind it<textarea rows={5}/></label>
        <div className="dropzone"><strong>Choose photos, videos, audio, letters, or keepsakes</strong><p>Baby and childhood material is especially welcome.</p><input type="file" multiple accept="image/*,video/*,audio/*,.pdf"/></div>
        <label className="consent"><input type="checkbox"/> I permit these materials to be included in Sandi’s private birthday film.</label>
        <button className="primary">Submit memory</button>
      </>}
    </div>
  </div></section></main>;
}
