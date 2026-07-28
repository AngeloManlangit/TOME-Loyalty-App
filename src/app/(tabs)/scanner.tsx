import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useScanner } from "@src/features/receipts/useScanner";
import CameraCapture from "@src/components/scannerPage/cameraCapture";
import ReviewFields from "@src/components/scannerPage/reviewFields";
import { ResultSuccess, ResultRejected, ResultOffline } from "@src/components/scannerPage/resultScreens";
import { Colors } from "@src/constants/theme";

export default function ScannerScreen() {
    const scanner = useScanner();

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
                                <ActivityIndicator size="large" color={Colors.outlets.purple} />
                            </View>
                        )}
                    </View>
                );
            case 'review':
            case 'submitting':
                return (
                    <ReviewFields 
                        scanner={scanner} 
                        candidates={scanner.state.scan.candidates} 
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
        <View style={styles.container}>
            {renderContent()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
