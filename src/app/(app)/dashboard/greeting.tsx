"use client";
import { useEffect, useState } from "react";

export function Greeting({ name }: { name: string }) {
  const [part, setPart] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setPart(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return <p className="mt-5 text-lg text-white/90">{part}, {name} 👋</p>;
}
