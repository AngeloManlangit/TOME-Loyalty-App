import { StampCardDetails } from "@/assets/classes/stamps";
import { StyleSheet, View, Modal, TouchableOpacity, Text, Alert } from "react-native";
import StampCard from "./stampCard";
import { useRef } from "react";
import ViewShot, { captureRef } from "react-native-view-shot";
import Share from "react-native-share";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";

interface ShareStampInterface {
    s: StampCardDetails;
    visible: boolean;
    onClose: () => void;
}

export default function ShareStampModal({ s, visible, onClose }: ShareStampInterface) {
    const viewShotRef = useRef<any>(null);

    const captureView = async () => {
        try {
            const uri = await captureRef(viewShotRef, {
                format: "jpg",
                quality: 0.9,
            });
            return uri;
        } catch (error) {
            Alert.alert("Error", "Could not generate the image.");
            return null;
        }
    };

    const handleShare = async () => {
        const uri = await captureView();
        if (!uri) return;

        try {
            await Share.open({
                url: uri,
                type: 'image/jpeg',
            });
        } catch (error: any) {
            console.log("Share canceled", error.message);
        }
    };

    const handleDownload = async () => {
        const uri = await captureView();
        if (!uri) return;

        try {
            await CameraRoll.save(uri, { type: 'photo' });
            Alert.alert("Success", "Image saved to your gallery!");
        } catch (error) {
            Alert.alert("Error", "Failed to save image. Check permissions.");
        }
    };

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalBackground}>
                <View style={styles.modalContainer}>
                    {/* The component to capture */}
                    <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
                        <StampCard cardDetails={s} />
                    </ViewShot>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.button} onPress={handleDownload}>
                            <Text style={styles.buttonText}>Download</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.shareButton]} onPress={handleShare}>
                            <Text style={styles.buttonText}>Share</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 10,
    },
    button: {
        flex: 1,
        padding: 12,
        backgroundColor: '#2ecc71',
        borderRadius: 8,
        alignItems: 'center',
    },
    shareButton: {
        backgroundColor: '#e67e22',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    closeButton: {
        marginTop: 15,
        padding: 10,
    },
    closeText: {
        color: '#7f8c8d',
    }
});