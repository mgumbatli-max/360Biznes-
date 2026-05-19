"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Avoid SSR/CSR mismatch by rendering nothing on the server.
    return <div className="hidden h-9 w-[120px] xl:block" aria-hidden />;
  }

  const time = now.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("az-AZ", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="hidden text-right xl:block">
      <div className="text-sm font-semibold tabular-nums">{time}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{date}</div>
    </div>
  );
}
