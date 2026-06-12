import { Redirect } from "expo-router";
import { useAuth } from "../src/lib/auth-store";

// Auth vəziyyəti məlum olana qədər heç nə render etmə (SplashScreen _layout-da
// göstərilir). Beləliklə root effekti ilə race yoxdur — tokensiz istifadəçi
// /(tabs)-ın yanıb-sönməsini görmür.
export default function Index() {
  const ready = useAuth((s) => s.ready);
  const access = useAuth((s) => s.access);
  if (!ready) return null;
  return <Redirect href={access ? "/(tabs)" : "/(auth)/login"} />;
}
