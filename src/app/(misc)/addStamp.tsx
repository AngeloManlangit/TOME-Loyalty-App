import { StampCardDetails } from "@/assets/classes/stamps";
import StampCard from "@/src/components/stamps/stampCard";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useState } from "react";

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
        scale.set(() => 0.90); // Shrink slightly

        // short cooldown so that users can't spam and the scale has time to grow a little
        setTimeout(() => {
            setIsDisabled(false);
        }, 200);
    };

    const handlePressOut = () => {
        scale.set(() => withSpring(1, { duration: 550, dampingRatio: 1 , velocity: 5 })); // Snap back to normal
    };

    return(
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardButton: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    }
})