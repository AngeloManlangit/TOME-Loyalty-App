import { Colors, Fonts } from "@src/constants/theme";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ReceiptGuideOverlay from "./receiptGuideOverlay";



interface Props {
    onCaptured: (imageUri: string) => void;
    busy: boolean;
}

export default function CameraCapture({ onCaptured, busy }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [capturing, setCapturing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

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

    const takePicture = async () => {
        if (capturing || busy) return;
        setCapturing(true);

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

    const disabled = capturing || busy;

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                // iOS only in SDK 57; harmless elsewhere. Android focus is carried by the guide frame
                // and the review screen rather than by this prop.
                autofocus="on"
            />

            <ReceiptGuideOverlay />

            <View style={styles.shutterRow}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take photo of receipt"
                    onPress={takePicture}
                    disabled={disabled}
                    style={[styles.shutter, disabled && styles.shutterDisabled]}
                >
                    {disabled ? (
                        <ActivityIndicator color={Colors.outlets.purple} />
                    ) : (
                        <View style={styles.shutterInner} />
                    )}
                </Pressable>
            </View>
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
    shutterRow: {
        position: "absolute",
        bottom: 90,
        left: 0,
        right: 0,
        alignItems: "center",
    },
    shutter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#fff",
        borderWidth: 4,
        borderColor: `${Colors.outlets.purple}AA`,
        justifyContent: "center",
        alignItems: "center",
    },
    shutterDisabled: {
        opacity: 0.6,
    },
    shutterInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: Colors.outlets.purple,
    },
});
