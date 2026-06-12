import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "../src/lib/query";
import { useAuth } from "../src/lib/auth-store";
import { useAppModeStore } from "../src/lib/app-mode-store";
import { SplashScreen } from "../src/components/SplashScreen";

export default function RootLayout() {
  const ready = useAuth((s) => s.ready);
  const access = useAuth((s) => s.access);
  const load = useAuth((s) => s.load);
  const loadMode = useAppModeStore((s) => s.load);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    load();
  }, [load]);

  // Cihaz-lokal Lite/Pro rejimini yüklə (auth gate-dən asılı deyil).
  useEffect(() => {
    loadMode();
  }, [loadMode]);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    if (!access && !inAuth) router.replace("/(auth)/login");
    else if (access && inAuth) router.replace("/(tabs)");
  }, [ready, access, segments, router]);

  if (!ready) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
