import React, { useRef, useState, useEffect } from "react";
import { ActivityIndicator, BackHandler, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

// Mobil sayt (360biznes.az) — app onu tam ekran göstərir = mobil versiya ilə 1-1.
const SITE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string) ||
  "https://www.360biznes.az";

// Telefona tam oturması üçün: viewport-u device-width-ə kilidlə + zoom/pan söndür
// (sağa-sola sürüşmənin qarşısı) + horizontal overflow gizlə.
const FIX_JS = `
(function(){
  function fix(){
    var vp = document.querySelector('meta[name=viewport]');
    if(!vp){ vp = document.createElement('meta'); vp.setAttribute('name','viewport'); document.head.appendChild(vp); }
    vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    if(!document.getElementById('rn-fix-style')){
      var s = document.createElement('style');
      s.id='rn-fix-style';
      s.innerHTML='html,body{overflow-x:hidden !important; max-width:100% !important; touch-action:pan-y !important; -webkit-text-size-adjust:100% !important;}';
      (document.head||document.documentElement).appendChild(s);
    }
  }
  fix();
  setTimeout(fix, 600);
})();
true;
`;

export default function Index() {
  const ref = useRef<WebView>(null);
  const [firstDone, setFirstDone] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [errored, setErrored] = useState(false);

  // Android aparat "geri" → WebView-də geri
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && ref.current) {
        ref.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  function reload() {
    setErrored(false);
    setFirstDone(false);
    ref.current?.reload();
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <WebView
        ref={ref}
        source={{ uri: SITE }}
        style={{ flex: 1, backgroundColor: "#ffffff" }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        // Telefona oturma + zoom söndür
        injectedJavaScript={FIX_JS}
        injectedJavaScriptBeforeContentLoaded={FIX_JS}
        scalesPageToFit={false}
        // POS barkod skanı üçün kamera (getUserMedia)
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowFileAccess
        setSupportMultipleWindows={false}
        // Yüklənmə overlay-i YALNIZ ilk açılışda göstərilir; SPA naviqasiyada
        // (login → dashboard) onLoadEnd işləməyə bilər → spinner donmasın deyə.
        onLoadEnd={() => setFirstDone(true)}
        onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
        onError={() => { setErrored(true); setFirstDone(true); }}
        onHttpError={() => setFirstDone(true)}
        onContentProcessDidTerminate={() => ref.current?.reload()}
        renderError={() => <View style={{ flex: 1 }} />}
      />

      {/* Yüklənmə göstəricisi — yalnız ilk açılış */}
      {!firstDone && !errored ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }} pointerEvents="none">
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={{ marginTop: 12, color: "#757a85", fontSize: 13 }}>360Biznes yüklənir…</Text>
        </View>
      ) : null}

      {/* Bağlantı yoxdursa */}
      {errored ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", paddingHorizontal: 32 }}>
          <Text style={{ color: "#141820", fontSize: 16, fontWeight: "700", textAlign: "center" }}>Bağlantı yoxdur</Text>
          <Text style={{ color: "#757a85", fontSize: 13, textAlign: "center", marginTop: 6 }}>İnternet bağlantınızı yoxlayın və yenidən cəhd edin.</Text>
          <Pressable onPress={reload} style={{ marginTop: 16, backgroundColor: "#0d9488", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Yenidən cəhd et</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
