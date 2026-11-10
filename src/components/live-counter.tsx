"use client";

import { useEffect, useState } from "react";
import { readStats } from "@/lib/stats";

export default function LiveCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    readStats().then((s) => {
      if (s) setCount(s.filesProcessed);
    });
  }, []);

  return (
    <span className="tabular-nums">
      {count === null ? "—" : count.toLocaleString("en-US")}
    </span>
  );
}
