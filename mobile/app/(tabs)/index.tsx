import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  TrendingUp, Wallet, AlertTriangle, Boxes, Sparkles, Bell, Search,
  ShieldAlert, FileBarChart, Plus, X, SlidersHorizontal, ChevronUp, ChevronDown, Trash2,
  Moon, Sun,
} from "lucide-react-native";
import { Screen } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { useAppModeStore } from "../../src/lib/app-mode-store";
import { useOzet } from "../../src/features/ozet/hooks";
import { useQuickActions } from "../../src/features/quick-actions/store";
import { QA_CATALOG, QA_MAP, type QAItem } from "../../src/features/quick-actions/catalog";
import { formatMoney } from "../../src/lib/format";
import { C, TONE, useThemeStore, type ToneKey } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const NUM = { fontVariant: ["tabular-nums" as const] };
const AZ_DAYS = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
const AZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(" ").filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].charAt(0).toUpperCase();
  return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
}
function greeting(): { label: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 6) return { label: "Gecəniz xeyrə qalsın", emoji: "🌙" };
  if (h < 12) return { label: "Sabahın xeyir", emoji: "☀️" };
  if (h < 17) return { label: "Gününüz xeyir", emoji: "🌤️" };
  if (h < 22) return { label: "Axşamın xeyir", emoji: "🌆" };
  return { label: "Gecəniz xeyrə qalsın", emoji: "🌙" };
}
function azDate(): string {
  const d = new Date();
  return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${AZ_DAYS[d.getDay()]}`;
}

function IconBtn({ children, onPress, filled = false, danger = false, badge }: { children: React.ReactNode; onPress: () => void; filled?: boolean; danger?: boolean; badge?: number }) {
  const bg = danger ? TONE.danger.bg : filled ? C.brand : C.card;
  const border = danger ? "#fecaca" : filled ? C.brand : C.line;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, width: 38, height: 38, borderRadius: 19, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" })}>
      {children}
      {badge != null && badge > 0 ? (
        <View style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.neg, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bg }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{badge > 99 ? "99" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MetricCard({ Icon, label, value, sub, tone = "neutral", onPress }: { Icon: LucideIcon; label: string; value: string; sub?: string; tone?: ToneKey; onPress?: () => void }) {
  const t = TONE[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 12, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.sub, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={t.fg} strokeWidth={2.2} />
        </View>
      </View>
      <Text style={{ color: tone === "neutral" ? C.ink : t.fg, fontSize: 20, fontWeight: "800", marginTop: 8, ...NUM }} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={{ color: C.sub, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

function ActionCard({ item, full, onPress }: { item: QAItem; full?: boolean; onPress: () => void }) {
  const Icon = item.Icon;
  // Web kimi rəngli-tonlu fon (color/8% tint + color/20% border)
  const tintBg = item.colors[1] + "14";
  const tintBorder = item.colors[1] + "33";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: full ? undefined : 1, width: full ? "100%" : undefined, backgroundColor: tintBg, borderRadius: 16, borderWidth: 1, borderColor: tintBorder, padding: 14 })}>
      <LinearGradient colors={item.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon size={22} color="#fff" strokeWidth={2.2} />
      </LinearGradient>
      <Text style={{ color: C.ink, fontSize: 15, fontWeight: "700" }}>{item.title}</Text>
      <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{item.desc}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { data: ozet } = useOzet();
  const { keys, load, toggle, move, reset } = useQuickActions();
  const [customize, setCustomize] = useState(false);

  useEffect(() => { load(); }, [load]);

  const initials = getInitials(user?.ad_soyad);
  const kritik = ozet?.products?.kritik ?? 0;
  const borc = ozet?.sales?.borc_mebleg ?? 0;
  const g = greeting();
  const firstName = (user?.ad_soyad ?? "İstifadəçi").split(" ")[0];

  // İstifadəçinin sırası ilə (birinci = hero, qalanı 2-sütun grid)
  const selected = keys.map((k) => QA_MAP[k]).filter(Boolean) as QAItem[];
  const hero = selected[0] ?? null;
  const gridItems = selected.slice(1);
  const gridRows: QAItem[][] = [];
  for (let i = 0; i < gridItems.length; i += 2) gridRows.push(gridItems.slice(i, i + 2));

  function go(route: string) { router.push(route as never); }

  return (
    <Screen>
      {/* Yuxarı toolbar — web kimi: avatar · Lite/Pro · axtarış · bildiriş */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 8 }}>
        <Pressable onPress={() => router.push("/profil")} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Profil">
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{initials}</Text>
        </Pressable>
        {/* Lite / Pro */}
        <View style={{ flexDirection: "row", backgroundColor: C.bg, borderRadius: 999, padding: 3, borderWidth: 1, borderColor: C.line }}>
          {(["lite", "pro"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={{ paddingHorizontal: 13, paddingVertical: 5, borderRadius: 999, backgroundColor: mode === m ? C.brand : "transparent" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: mode === m ? "#fff" : C.sub }}>{m === "lite" ? "Lite" : "Pro"}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <IconBtn onPress={() => router.push("/mehsullar")}><Search size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => toggleTheme()}>{themeMode === "dark" ? <Sun size={18} color={C.warn} /> : <Moon size={18} color={C.ink} />}</IconBtn>
        {kritik > 0 ? <IconBtn onPress={() => router.push("/mehsullar")} danger badge={kritik}><AlertTriangle size={18} color={C.neg} /></IconBtn> : null}
        <IconBtn onPress={() => router.push("/bildiris")}><Bell size={18} color={C.ink} /></IconBtn>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Salamlama kartı */}
        <View style={{ marginHorizontal: 16, marginTop: 6, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.bg }}>
            <Text style={{ fontSize: 11 }}>{g.emoji}</Text>
            <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>{g.label}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
            <Text style={{ color: C.ai, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>{firstName}</Text>
            <Text style={{ fontSize: 22, marginLeft: 4 }}>👋</Text>
            <Text style={{ color: C.sub, fontSize: 13, fontWeight: "500", marginLeft: 8, marginBottom: 4 }}>biznesin hazırdır</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Text style={{ color: C.sub, fontSize: 12.5 }} numberOfLines={1}>{azDate()}</Text>
            {user?.sahibkar_ad ? (
              <>
                <Text style={{ color: C.sub, fontSize: 12 }}>·</Text>
                <Sparkles size={12} color={C.brand} />
                <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>{user.sahibkar_ad}</Text>
              </>
            ) : null}
          </View>
          {/* Nəzarət / Hesabat */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Pressable onPress={() => router.push("/mehsullar")} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10 })}>
              <ShieldAlert size={15} color={C.ink} />
              <Text style={{ color: C.ink, fontSize: 13, fontWeight: "600" }}>Nəzarət</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/maliyye")} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10 })}>
              <FileBarChart size={15} color={C.ink} />
              <Text style={{ color: C.ink, fontSize: 13, fontWeight: "600" }}>Hesabat</Text>
            </Pressable>
          </View>
        </View>

        {/* KPI */}
        {(ozet?.sales || ozet?.products) && (
          <View style={{ marginHorizontal: 16, marginTop: 14, gap: 10 }}>
            {ozet?.sales && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MetricCard Icon={TrendingUp} label="Bugün" value={formatMoney(ozet.sales.bugun.mebleg)} sub={`${ozet.sales.bugun.count} satış`} tone="success" onPress={() => router.push("/(tabs)/satis")} />
                <MetricCard Icon={Wallet} label="Bu ay" value={formatMoney(ozet.sales.bu_ay.mebleg)} sub={`${ozet.sales.bu_ay.count} satış`} tone="info" onPress={() => router.push("/(tabs)/satis")} />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ozet?.sales && (
                <MetricCard Icon={AlertTriangle} label="Açıq borc" value={formatMoney(borc)} tone={borc > 0 ? "danger" : "neutral"} onPress={() => router.push("/musteri")} />
              )}
              {ozet?.products && (
                <MetricCard Icon={Boxes} label="Kritik stok" value={String(kritik)} sub={`${ozet.products.toplam_aktiv ?? 0} məhsul`} tone={kritik > 0 ? "danger" : "success"} onPress={() => router.push("/mehsullar")} />
              )}
            </View>
          </View>
        )}

        {/* Sürətli əməliyyat + Düzəlt */}
        <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 22, marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "800", color: C.ink }}>Sürətli əməliyyat</Text>
          <Pressable onPress={() => setCustomize(true)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: C.bg })}>
            <SlidersHorizontal size={14} color={C.brand} />
            <Text style={{ color: C.brand, fontSize: 12.5, fontWeight: "700" }}>Düzəlt</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {hero ? <ActionCard item={hero} full onPress={() => go(hero.route)} /> : null}
          {gridRows.map((pair, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <ActionCard item={pair[0]} onPress={() => go(pair[0].route)} />
              {pair[1] ? <ActionCard item={pair[1]} onPress={() => go(pair[1].route)} /> : <View style={{ flex: 1 }} />}
            </View>
          ))}
          {/* Funksiya əlavə et */}
          <Pressable onPress={() => setCustomize(true)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: C.line, borderStyle: "dashed", borderRadius: 16, paddingVertical: 16 })}>
            <Plus size={18} color={C.sub} />
            <Text style={{ color: C.sub, fontSize: 14, fontWeight: "600" }}>Funksiya əlavə et / düzəlt</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Özelleşdirmə modalı */}
      <CustomizeModal visible={customize} keys={keys} onToggle={toggle} onMove={move} onReset={reset} onClose={() => setCustomize(false)} />
    </Screen>
  );
}

function CustomizeModal({ visible, keys, onToggle, onMove, onReset, onClose }: { visible: boolean; keys: string[]; onToggle: (k: string) => void; onMove: (k: string, dir: "up" | "down") => void; onReset: () => void; onClose: () => void }) {
  const selectedItems = keys.map((k) => QA_MAP[k]).filter(Boolean) as QAItem[];
  const available = QA_CATALOG.filter((q) => !keys.includes(q.key));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, height: "82%", paddingTop: 10 }}>
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontSize: 17, fontWeight: "800" }}>Sürətli əməliyyatlar</Text>
              <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>Ana səhifədə görmək istədiklərinizi seçin</Text>
            </View>
            <Pressable onPress={onReset} hitSlop={8} style={{ marginRight: 8, paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={{ color: C.brand, fontSize: 13, fontWeight: "700" }}>Bərpa</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}><X size={22} color={C.sub} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}>
            <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Seçilmiş — sıranı dəyiş</Text>
            {selectedItems.map((q, idx) => {
              const Icon = q.Icon;
              return (
                <View key={q.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 10 }}>
                  <LinearGradient colors={q.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
                    <Icon size={19} color="#fff" strokeWidth={2.2} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.ink, fontSize: 14, fontWeight: "700" }}>{q.title}</Text>
                    {idx === 0 ? <Text style={{ color: C.brand, fontSize: 10.5, fontWeight: "600" }}>Böyük kart (ən üstdə)</Text> : null}
                  </View>
                  <Pressable onPress={() => onMove(q.key, "up")} disabled={idx === 0} hitSlop={6} style={{ padding: 5, opacity: idx === 0 ? 0.3 : 1 }}><ChevronUp size={18} color={C.ink} /></Pressable>
                  <Pressable onPress={() => onMove(q.key, "down")} disabled={idx === selectedItems.length - 1} hitSlop={6} style={{ padding: 5, opacity: idx === selectedItems.length - 1 ? 0.3 : 1 }}><ChevronDown size={18} color={C.ink} /></Pressable>
                  <Pressable onPress={() => onToggle(q.key)} hitSlop={6} style={{ padding: 5 }}><Trash2 size={17} color={C.neg} /></Pressable>
                </View>
              );
            })}
            {available.length > 0 ? (
              <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 2 }}>Əlavə et</Text>
            ) : null}
            {available.map((q) => {
              const Icon = q.Icon;
              return (
                <Pressable key={q.key} onPress={() => onToggle(q.key)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 10 })}>
                  <LinearGradient colors={q.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
                    <Icon size={19} color="#fff" strokeWidth={2.2} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.ink, fontSize: 14, fontWeight: "700" }}>{q.title}</Text>
                    <Text style={{ color: C.sub, fontSize: 12 }} numberOfLines={1}>{q.desc}</Text>
                  </View>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}><Plus size={17} color="#fff" strokeWidth={2.6} /></View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
