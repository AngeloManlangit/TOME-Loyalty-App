import { StampCardDetails } from "@/assets/classes/stamps";
import StampCard from "@/src/components/stamps/stampCard";
import { router, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, View, Text, Image, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useState } from "react";
import { UserProvider, useUser } from "@/src/contexts/userContext";
import { bgTransparency, Colors, Fonts } from "@/src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

export default function AddStamp() {
    const { details } = useLocalSearchParams();
    const parsedDetails = details ? JSON.parse(details as string) : null;
    const stampCard = parsedDetails as StampCardDetails;

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

    const { user } = useUser();
    const router = useRouter();

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
                                    <Text style={styles.stampCount}>{user.stamp_bank}</Text>
                                </View>

                                <Pressable
                                    onPressIn={handlePressIn}
                                    onPressOut={handlePressOut}
                                    style={styles.cardButton}
                                    disabled={isDisabled}
                                >
                                    <Animated.View style={animatedStyle}>
                                        <StampCard cardDetails={stampCard} />
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
})