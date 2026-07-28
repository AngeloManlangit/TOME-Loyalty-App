import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useEffect } from "react";
import { useScanner } from "@src/features/receipts/useScanner";
import { useScannerUi } from "@src/features/receipts/scannerUiContext";
import { useStamps } from "@src/contexts/stampContext";
import CameraCapture from "@src/components/scannerPage/cameraCapture";
import ConfirmFields from "@src/components/scannerPage/confirmFields";
import ExitChevron from "@src/components/scannerPage/exitChevron";
import { ResultSuccess, ResultRejected, ResultOffline } from "@src/components/scannerPage/resultScreens";
import { Colors } from "@src/constants/theme";

export default function ScannerScreen() {
    const { refresh } = useStamps();
    // A claim changes the wallet balance the header shows, so refresh it before the user navigates
    // back to look at it.
    const scanner = useScanner(undefined, refresh);
    const { setMode } = useScannerUi();

    const showsCamera = scanner.state.phase === 'idle' || scanner.state.phase === 'processing';

    // The camera owns the FAB while it is on screen. Every other phase has its own on-screen
    // buttons, so the shutter is dimmed and inert rather than pressable and meaningless.
    useEffect(() => {
        if (!showsCamera) setMode('inactive');
    }, [showsCamera, setMode]);

    const renderContent = () => {
        switch (scanner.state.phase) {
            case 'idle':
            case 'processing':
                return (
                    <View style={styles.container}>
                        <CameraCapture
                            onCaptured={scanner.capture}
                            busy={scanner.state.phase === 'processing'}
                        />
                        {scanner.state.phase === 'processing' && (
                            <View style={styles.overlay}>
                                <ActivityIndicator size="large" color="#fff" />
                            </View>
                        )}
                    </View>
                );
            case 'confirm':
            case 'submitting':
                return (
                    <ConfirmFields
                        scanner={scanner}
                        submitting={scanner.state.phase === 'submitting'}
                    />
                );
            case 'success':
                return <ResultSuccess result={scanner.state.result} onDone={scanner.reset} />;
            case 'rejected':
                return <ResultRejected error={scanner.state.error} onRetry={scanner.reset} />;
            case 'offline':
                return <ResultOffline onRetry={scanner.reset} />;
            default:
                return null;
        }
    };

    return (
        <View style={[styles.container, !showsCamera && styles.lightBackground]}>
            {renderContent()}
            {/* Leaving mid-flow drops the scan. Nothing is burned: no receipt was written and the
                session simply expires under its TTL. */}
            <ExitChevron onExit={scanner.reset} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    lightBackground: {
        backgroundColor: Colors.light.background,
    },
    overlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
