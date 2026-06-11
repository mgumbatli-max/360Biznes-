"use client";

import { useEffect, useState } from "react";

/**
 * Modul icmal tabının görünməsi — layout `<html data-icmal="ticaret,...">`
 * yazır (ayar + rol icazəsinə görə); client subnavlar buradan oxuyur.
 */
export function useIcmalOn(mod: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () =>
      setOn((document.documentElement.dataset.icmal ?? "").split(",").includes(mod));
    read();
    // Naviqasiyada layout scripti yenidən işləyir — atribut dəyişimini izlə
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-icmal"] });
    return () => obs.disconnect();
  }, [mod]);
  return on;
}
