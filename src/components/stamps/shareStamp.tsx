import { StampCardDetails } from "@/assets/classes/stamps";
import { StyleSheet, View, Modal, TouchableOpacity, Text, Alert, Image } from "react-native";
import StampCard from "./stampCard";
import { useRef } from "react";
import ViewShot, { captureRef } from "react-native-view-shot";
import Share from "react-native-share";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { Colors, Fonts } from "@/src/constants/theme";
import { Download, ShareIcon } from "lucide-react-native";

import { useUser } from "@src/contexts/userContext";

interface ShareStampInterface {
    s: StampCardDetails;
    visible: boolean;
    onClose: () => void;
}

export default function ShareStampModal({ s, visible, onClose }: ShareStampInterface) {
    const viewShotRef = useRef<any>(null);

    const { user } = useUser();

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
                    <Text style={styles.shareTitle}>Share stamp card</Text>
                    <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
                        <View style={styles.pictureContainer}>
                            <View style={styles.headerRow}>
                                <Image 
                                    style={styles.logo}
                                    source={require('@/assets/images/TOME Colored.png')} 
                                    resizeMode="contain"    
                                />

                                <Image 
                                    source={(user) ? { uri: user?.profile_img_url } : require('@/assets/images/fallbackUserProfile.png')} 
                                    style={[styles.profileImage, { borderColor: user?.card_background_color }]} 
                                />
                            </View>
                            <StampCard cardDetails={s} />
                            <Text style={styles.cardTitle}>{s.stampCard_configs.title}</Text>
                            <Text style={styles.username}>@{user?.username}</Text>
                        </View>
                    </ViewShot>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.button} onPress={handleDownload}>
                            <Download color={'#fff'} />
                            <Text style={styles.buttonText}>Download</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.shareButton]} onPress={handleShare}>
                            <ShareIcon color={'#fff'} />
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
        paddingHorizontal: 20,
        paddingVertical: 10,
        alignItems: 'center',
        borderColor: '#414141b1',
        borderWidth: 1,
    },
    shareTitle: {
        fontFamily: Fonts.Montserrat,
        fontSize: 22,
        paddingVertical: 8,
        textTransform: 'uppercase'
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 10,
    },
    button: {
        flex: 1,
        padding: 12,
        backgroundColor: Colors.outlets.purple,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 7,
        alignItems: 'center',
    },
    shareButton: {
        backgroundColor: Colors.outlets.pink,
    },
    buttonText: {
        color: '#fff',
        fontFamily: Fonts.Lato_Bold
    },
    closeButton: {
        marginTop: 10,
        padding: 8,
    },
    closeText: {
        color: '#7f8c8d',
    },
    pictureContainer: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderColor: '#b6b6b662',
        borderWidth: 1,
        borderRadius: 18
    },
    headerRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    logo: {
        width: 130,
        height: 50,
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderColor: '#ffd9f9',
        borderWidth: 2,
    },
    cardTitle: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 18,
        paddingTop: 10,
        paddingBottom: 5
    },
    username: {
        fontFamily: Fonts.Lato,
        fontSize: 13,
        color: '#656060'
    }
});