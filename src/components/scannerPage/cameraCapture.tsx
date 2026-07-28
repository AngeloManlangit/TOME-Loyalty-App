import { Colors, Fonts } from "@src/constants/theme";
import { useScannerUi } from "@src/features/receipts/scannerUiContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ReceiptGuideOverlay from "./receiptGuideOverlay";
import { CaptureFlash } from "./scannerButton";



interface Props {
    onCaptured: (imageUri: string) => void;
    busy: boolean;
}

/**
 * The camera surface. It has NO shutter of its own — the tab-bar FAB is the shutter, so this
 * registers its capture function with the scanner UI context and the button calls it.
 */
export default function CameraCapture({ onCaptured, busy }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [capturing, setCapturing] = useState(false);
    const [flash, setFlash] = useState(0);
    const cameraRef = useRef<CameraView>(null);
    const { setMode, registerShutter } = useScannerUi();

    const granted = permission?.granted === true;
    const disabled = capturing || busy;

    const takePicture = async () => {
        if (capturing || busy) return;
        setCapturing(true);
        setFlash((n) => n + 1);

        try {
            const photo = await cameraRef.current?.takePictureAsync({
                quality: 0.8,
                // Orientation adjustment left on: a sideways capture would defeat the deskew, which
                // corrects tilt of a few degrees, not a 90-degree rotation.
                skipProcessing: false,
            });
            if (photo?.uri) onCaptured(photo.uri);
        } finally {
            setCapturing(false);
        }
    };

    // Hand the FAB something to call, and take it back on unmount so a press landing after the
    // screen has gone cannot fire into a dead camera.
    useEffect(() => {
        registerShutter(takePicture);
        return () => registerShutter(null);
    });

    // Drives the FAB's appearance. 'inactive' while permission is unresolved or denied, so the
    // button never looks like a working shutter when pressing it could not take a photo.
    useEffect(() => {
        if (!granted) {
            setMode('inactive');
            return;
        }
        setMode(disabled ? 'busy' : 'ready');
    }, [granted, disabled, setMode]);

    // Permission is still resolving. Rendering nothing avoids a flash of the denied state.
    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
        const permanentlyDenied = !permission.canAskAgain;

        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.permissionTitle}>Camera access needed</Text>
                <Text style={styles.permissionBody}>
                    {permanentlyDenied
                        ? "Camera access is turned off for this app. Enable it in Settings to scan receipts."
                        : "We need your camera to photograph receipts. Nothing is uploaded until you take a photo."}
                </Text>

                <Pressable
                    style={styles.primaryButton}
                    onPress={() => (permanentlyDenied ? Linking.openSettings() : requestPermission())}
                >
                    <Text style={styles.primaryButtonText}>
                        {permanentlyDenied ? "OPEN SETTINGS" : "ALLOW CAMERA"}
                    </Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                // iOS only in SDK 57; harmless elsewhere. Android focus is carried by the guide frame
                // and the confirmation screen rather than by this prop.
                autofocus="on"
            />

            <ReceiptGuideOverlay />

            <Text style={styles.hint}>Tap the button below to capture</Text>

            <CaptureFlash trigger={flash} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
        backgroundColor: "#fff",
    },
    permissionTitle: {
        fontFamily: Fonts.Montserrat,
        fontSize: 22,
        color: Colors.outlets.purple,
        marginBottom: 12,
        textAlign: "center",
    },
    permissionBody: {
        fontFamily: Fonts.Lato,
        fontSize: 15,
        lineHeight: 22,
        color: Colors.light.textSecondary,
        textAlign: "center",
        marginBottom: 28,
    },
    primaryButton: {
        backgroundColor: Colors.outlets.purple,
        paddingVertical: 14,
        paddingHorizontal: 36,
        borderRadius: 50,
    },
    primaryButtonText: {
        color: "#fff",
        fontFamily: Fonts.Lato_Bold,
        fontSize: 16,
        letterSpacing: 1,
    },
    hint: {
        position: "absolute",
        bottom: 96,
        left: 0,
        right: 0,
        textAlign: "center",
        color: "#ffffffDD",
        fontFamily: Fonts.Lato,
        fontSize: 14,
        letterSpacing: 0.6,
    },
});
