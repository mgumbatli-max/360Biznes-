/**
 * BarcodeScanner — tam ekran barkod skaneri
 *
 * SDK 56 expo-camera: CameraView + useCameraPermissions
 * useCameraPermissions → [status | null, requestPermission, getPermission]
 */

import React, { useEffect, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { X } from "lucide-react-native";
import { C } from "../theme";
import { Button } from "./Button";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
};

export function BarcodeScanner({ visible, onClose, onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  // Skan bir dəfə tetiklənsin deyə guard
  const scannedRef = useRef(false);

  // Modal görünəndə guard-ı sıfırla
  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
    }
  }, [visible]);

  const handleScan = (result: BarcodeScanningResult) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScanned(result.data);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* İcazə yoxdur */}
        {!permission?.granted ? (
          <View style={styles.permContainer}>
            <Text style={styles.permText}>
              Barkod skan etmək üçün kameraya icazə tələb olunur.
            </Text>
            <Button title="Kameraya icazə ver" onPress={requestPermission} />
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Bağla</Text>
            </Pressable>
          </View>
        ) : (
          /* Kamera görünüşü */
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "code128",
                  "code39",
                  "qr",
                ],
              }}
              onBarcodeScanned={handleScan}
            />

            {/* Üst overlay */}
            <View style={styles.topOverlay}>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Bağla"
              >
                <X size={22} color="#fff" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.hint}>Barkodu çərçivəyə tutun</Text>
            </View>

            {/* Orta vizual çərçivə */}
            <View style={styles.frameContainer} pointerEvents="none">
              <View style={styles.frame} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  permText: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },
  cancelBtn: {
    marginTop: 8,
    padding: 12,
  },
  cancelText: {
    color: C.sub,
    fontSize: 14,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closeBtn: {
    padding: 6,
  },
  hint: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
    textAlign: "center",
  },
  frameContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderWidth: 2,
    borderColor: C.brand,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
});
