import { StampCardDetails } from "@/assets/classes/stamps";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import StampCard from "./stampCard";
import { Colors, Fonts } from "@/src/constants/theme";
import { EditIcon, TrashIcon } from "lucide-react-native";
import { router } from "expo-router";

interface StampPopupDetailsInterface {
    stamp: StampCardDetails;
}

export default function StampPopupDetails({stamp}: StampPopupDetailsInterface) {

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
            
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <TouchableOpacity style={styles.button} onPress={() => handleEditPress(stamp)}>
                    <EditIcon color={'#fff'} />
                    <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, {backgroundColor: Colors.outlets.pink}]}>
                    <TrashIcon color={'#fff'} />
                    <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
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
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: Colors.outlets.purple,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7
    },
    buttonText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: Fonts.Lato
    },
})