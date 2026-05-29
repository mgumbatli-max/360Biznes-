"use client";

import dynamic from "next/dynamic";

/**
 * 667 LOC servis modalını lazy yükləyirik — yalnız URL-də ?servis=ID olduqda
 * istifadəçi modalı açanda chunk gəlir. Server-rendered səhifədə baş yük yox.
 */
const ServisDetailModalRouter = dynamic(
  () => import("./servis-detail-modal").then((m) => m.ServisDetailModalRouter),
  { ssr: false }
);

export function ServisDetailModalMount() {
  return <ServisDetailModalRouter />;
}
