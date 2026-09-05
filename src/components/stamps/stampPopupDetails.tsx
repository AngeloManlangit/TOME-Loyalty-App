import { StampCardDetails } from "@/assets/classes/stamps";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import StampCard from "./stampCard";
import { Colors, Fonts } from "@/src/constants/theme";
import { CircleAlert, EditIcon, ShareIcon, StampIcon, TrashIcon } from "lucide-react-native";
import { router } from "expo-router";
import { stampService } from "@/src/services/stampService";
import { useState } from "react";

interface StampPopupDetailsInterface {
    stamp: StampCardDetails;
    onRefresh?: () => void;
}

export default function StampPopupDetails({stamp, onRefresh}: StampPopupDetailsInterface) {

    const historyContent = [];

    if (stamp.history) {
        for (let i = 0; i < stamp.history.length; i++) {
            historyContent.push(
                <View key={stamp.history[i].receipt_ID} style={styles.historyContentItem}>
                    <View style={styles.indexNumberBg}>
                        <Text style={styles.indexNumber}>{i + 1}</Text>
                    </View>
                    <View>
                        <Text style={styles.historyItemText}>Date stamped: {stamp.history[i].time_stamped.toLocaleString()}</Text>
                        <Text style={styles.historyItemText}>Receipt ID: {stamp.history[i].receipt_ID}</Text>
                    </View>
                </View>
            )
        }
    }

    const handleEditPress = (stampCardDetails: StampCardDetails) => {
        if (stampCardDetails.id){
            router.push({
                pathname: "/edit/stamp/[stamp_ID]",
                params: {
                    stamp_ID: stampCardDetails.id,
                    details: JSON.stringify(stampCardDetails), 
                },
            });
        }
    };

    const handleDeletePress = async () => {
        if (!stamp) return;
            
        try {
            const response = await stampService.deleteStamp(stamp);

            if (response?.success) {
                alert("Stamp deleted successfully!");
                if (onRefresh) onRefresh();
            }
            else {
                alert("Error in deleting stamp. Please again later.\nError: " + response?.error);
            }

            return;
        } catch (error) {
            console.error("Error deleting the stamp card:", error);
            alert("Failed to delete card.");
        }
    }

    const askDelete = () => {
        Alert.alert(
            'Delete stamp card?',
            'This action can not be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Confirm',
                    onPress: handleDeletePress
                },
            ],
            { cancelable: true }
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{stamp.stampCard_configs.title}</Text>
            <StampCard cardDetails={stamp} />
            <Text style={styles.subtitle}>ID: {stamp.id}</Text>
            
            <Text style={styles.historyTitle}>Stamp History: </Text>
            
            {
                (stamp.history) ? 
                    <View style={styles.historyContentContainer}>
                        {historyContent}
                    </View>
                    
                    :

                    <Text style={styles.noHistoryText}>No current history</Text>
            
            }
            
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity style={styles.button} onPress={() => handleEditPress(stamp)}>
                        <StampIcon color={'#fff'} />
                        <Text style={styles.buttonText}>Stamp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.button, { backgroundColor: Colors.outlets.green }]} 
                        onPress={() => handleEditPress(stamp)}
                    >
                        <ShareIcon color={'#fff'} />
                        <Text style={styles.buttonText}>Share</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity style={[styles.button, { backgroundColor: Colors.outlets.blue }]} 
                        onPress={() => handleEditPress(stamp)}
                    >
                        <EditIcon color={'#fff'} />
                        <Text style={styles.buttonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.button, {backgroundColor: Colors.outlets.pink}]}
                        onPress={askDelete}
                    >
                        <TrashIcon color={'#fff'} />
                        <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        gap: 5,
        paddingBottom: 200,
    },
    title: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 25
    },
    subtitle: {
        color: '#747474'
    },
    historyTitle: {
        marginTop: 10,
        fontFamily: Fonts.Montserrat,
        textTransform: 'uppercase',
        fontSize: 20
    },
    historyContentContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'flex-start',
    },
    historyContentItem: {
        width: '100%',
        paddingHorizontal: 20,
        paddingVertical: 5,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'flex-start'
    },
    historyItemText: {
        fontFamily: Fonts.Lato,
        fontSize: 15
    },
    noHistoryText: {
        fontFamily: Fonts.Lato,
        fontSize: 25,
        color: '#c7c7c7'
    },
    indexNumberBg: {
        backgroundColor: Colors.outlets.pink,
        width: 28,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 14
    },
    indexNumber: {
        fontFamily: Fonts.Montserrat,
        color: '#fff'
    },
    button: {
        flex: 1,
        marginTop: 20,
        paddingVertical: 10,
        backgroundColor: Colors.outlets.purple,
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 7
    },
    buttonText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: Fonts.Lato
    }
})