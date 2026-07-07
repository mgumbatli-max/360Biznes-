import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "../src/lib/query";
import { useAuth } from "../src/lib/auth-store";
import { api } from "../src/lib/api";
import { useAppModeStore } from "../src/lib/app-mode-store";
import { useThemeStore, C } from "../src/theme";
import { SplashScreen } from "../src/components/SplashScreen";

export default function RootLayout() {
  const ready = useAuth((s) => s.ready);
  const access = useAuth((s) => s.access);
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const load = useAuth((s) => s.load);
  const loadMode = useAppModeStore((s) => s.load);
  const themeMode = useThemeStore((s) => s.mode);
  const themeReady = useThemeStore((s) => s.ready);
  const loadTheme = useThemeStore((s) => s.load);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMode(); }, [loadMode]);
  useEffect(() => { loadTheme(); }, [loadTheme]);

  // QA-mobil: restart-da token bərpa olunur, amma user yox → /me-dən hidratlaşdır (profil/salamlama boş qalmasın).
  useEffect(() => {
    if (!ready || !access || user) return;
    let alive = true;
    api.get("/me")
      .then((r) => {
        const d = r.data as { user?: { id: string; ad_soyad: string; email: string; sahibkar_ad?: string | null }; rol_ad?: string };
        if (alive && d?.user) {
          setUser({
            id: d.user.id,
            ad_soyad: d.user.ad_soyad,
            email: d.user.email,
            sahibkar_ad: d.user.sahibkar_ad ?? undefined,
            rol_ad: d.rol_ad,
          });
        }
      })
      .catch(() => { /* 401 → interceptor refresh/logout idarə edir */ });
    return () => { alive = false; };
  }, [ready, access, user, setUser]);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    if (!access && !inAuth) router.replace("/(auth)/login");
    else if (access && inAuth) router.replace("/(tabs)");
  }, [ready, access, segments, router]);

  if (!ready || !themeReady) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
        {/* key={themeMode} → tema dəyişəndə remount, inline C dəyərləri yenilənir */}
        <View key={themeMode} style={{ flex: 1, backgroundColor: C.bg }}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
