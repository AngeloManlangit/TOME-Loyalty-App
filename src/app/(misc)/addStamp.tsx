import { StampCardDetails } from "@/assets/classes/stamps";
import StampCard from "@/src/components/stamps/stampCard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, View, Text, Image, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useState } from "react";
import { useUser } from "@/src/contexts/userContext";
import { bgTransparency, Colors, Fonts } from "@/src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Undo2 } from "lucide-react-native";

export default function AddStamp() {
    const { user } = useUser();
    const router = useRouter();
    
    const { details } = useLocalSearchParams();
    const parsedDetails = details ? JSON.parse(details as string) : null;
    const stampCard = parsedDetails as StampCardDetails;
    
    const [localStampsUsed, setLocalStampsUsed] = useState(0);
    const stampBankCount = (user?.stamp_bank || 0) - localStampsUsed;

    const scale = useSharedValue(1); //
    const [isDisabled, setIsDisabled] = useState(false);
    
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }], //
    }));
    
    const handlePressIn = () => {
        setIsDisabled(true);
        scale.set(() => withSpring(0.90, { duration: 20 })); // Shrink slightly

        // short cooldown so that users can't spam and the scale has time to grow a little
        setTimeout(() => {
            setIsDisabled(false);
        }, 200);
    };

    const handlePressOut = () => {
        scale.set(() => withSpring(1, { duration: 550, dampingRatio: 1 , velocity: 5 })); // Snap back to normal
    };

    const dynamicStampCard = {
        ...stampCard,
        stamp_count: (stampCard?.stamp_count || 0) + localStampsUsed
    };

    const addStamp = () => {
        if (stampBankCount > 0 && dynamicStampCard.stamp_count < dynamicStampCard.stamp_total) {
            setLocalStampsUsed(localStampsUsed + 1);
        }
    }

    const undoStamp = () => {
        if (localStampsUsed > 0) {
            setLocalStampsUsed(localStampsUsed - 1);
        }
    }

    return(
        <View style={styles.flexy}>
            <StatusBar barStyle={"dark-content"} />

            <LinearGradient
                colors={['#fff', `${Colors.outlets.yellow}${bgTransparency}`]}
                style={styles.flexy}
            >
                <SafeAreaView style={styles.flexy}>
                    {
                        user ? (
                            <View style={styles.container}>
                                
                                <View style={styles.stampCountContainer}>
                                    <Image 
                                        source={require('@/assets/images/stamp.png')}
                                        style={styles.stampImage}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.stampCount}>{stampBankCount}</Text>

                                    {
                                        (localStampsUsed > 0) ? (
                                            <TouchableOpacity
                                                style={styles.resetButton}
                                                onPress={undoStamp}
                                            >
                                                <Undo2 />
                                                <Text>Undo</Text>
                                            </TouchableOpacity>
                                        ) : ''
                                    }
                                </View>

                                <Pressable
                                    onPressIn={handlePressIn}
                                    onPressOut={handlePressOut}
                                    onPress={addStamp}
                                    style={styles.cardButton}
                                    disabled={isDisabled}
                                >
                                    <Animated.View style={animatedStyle}>
                                        <StampCard cardDetails={dynamicStampCard} />
                                    </Animated.View>
                                </Pressable>

                                <View style={styles.buttonContainer}>
                                    <TouchableOpacity style={[styles.button, { backgroundColor: Colors.outlets.purple }]}>
                                        <Text style={[styles.finishText]}>FINISH</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.button, { backgroundColor: '#e7e7e7' }]} onPress={() => router.back()}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.container}>
                                <Text>Loading...</Text>
                            </View>
                        )
                    }
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    flexy: {
        flex: 1
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stampCountContainer: {
        marginTop: -100,
        marginBottom: 20,
        flexDirection: 'row',
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10
    },
    stampImage: {
        height: 60,
        width: 60
    },
    stampCount: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 60
    },
    cardButton: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonContainer: {
        width: '100%',
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 10,
        marginTop: 100,
        marginBottom: -140
    },
    finishText: {
        color: '#fff',
        fontFamily: Fonts.Lato_Bold,
        fontSize: 20
    },
    cancelText: {
        color: '#00000080',
        fontFamily: Fonts.Lato,
        fontSize: 18
    },
    button: {
        width: '100%',
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10
    },
    resetButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        marginLeft: 8,
        marginRight: -20
    }
})