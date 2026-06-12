import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { Button, Input } from "../../src/components";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-store";
import { C } from "../../src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      const u = r.data.user;
      await useAuth.getState().setSession(
        r.data.accessToken,
        r.data.refreshToken,
        {
          id: u.id,
          ad_soyad: u.ad_soyad,
          email: u.email,
          sahibkar_ad: u.sahibkar_ad,
          rol_ad: u.rol_ad,
        },
      );
      router.replace("/(tabs)");
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: string } } };
      setErr(
        axiosErr?.response?.data?.error ?? "Giriş alınmadı. Şəbəkəni yoxlayın.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !email.trim() || !password;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center pt-20 pb-10 px-6">
          <Text className="text-brand text-3xl font-extrabold tracking-tight">
            360Biznes
          </Text>
          <Text className="text-sub text-sm mt-2">
            Hesabınıza daxil olun
          </Text>
        </View>

        {/* Form card */}
        <View className="flex-1 px-6 pb-10">
          <View className="bg-white rounded-3xl p-6 shadow-sm gap-4">
            {/* Email */}
            <Input
              label="E-poçt"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              placeholder="ornek@email.com"
              rightSlot={<Mail size={18} color={C.sub} />}
            />

            {/* Password */}
            <Input
              label="Şifrə"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              placeholder="••••••••"
              rightSlot={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityLabel={
                    showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} color={C.sub} />
                  ) : (
                    <Eye size={18} color={C.sub} />
                  )}
                </Pressable>
              }
            />

            {/* Error message */}
            {err != null && (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <Text className="text-neg text-sm">{err}</Text>
              </View>
            )}

            {/* Submit button */}
            <View className="mt-2">
              <Button
                title="Daxil ol"
                onPress={onLogin}
                loading={loading}
                disabled={isDisabled}
              />
            </View>
          </View>

          {/* Footer */}
          <Text className="text-sub text-xs text-center mt-6">
            © 2025 360Biznes. Bütün hüquqlar qorunur.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
