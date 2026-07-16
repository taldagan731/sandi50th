"use client";
import { useEffect, useState } from "react";

export function Countdown() {
  const [value, setValue] = useState({days:"--",hours:"--",minutes:"--",seconds:"--"});
  useEffect(() => {
    const target = new Date("2026-08-11T00:00:00-04:00").getTime();
    const update = () => {
      const d = Math.max(0, target - Date.now());
      setValue({
        days: String(Math.floor(d / 86400000)),
        hours: String(Math.floor(d / 3600000) % 24).padStart(2,"0"),
        minutes: String(Math.floor(d / 60000) % 60).padStart(2,"0"),
        seconds: String(Math.floor(d / 1000) % 60).padStart(2,"0")
      });
    };
    update(); const id = setInterval(update, 1000); return () => clearInterval(id);
  }, []);
  return <div className="countdown">{Object.entries(value).map(([k,v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>;
}
