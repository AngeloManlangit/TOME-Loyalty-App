import { Fonts } from "@src/constants/theme";
import { useStamps } from "@src/contexts/stampContext";
import { StampIcon } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from "react-native-reanimated";

/**
 * The user's unspent stamp count, shown to the left of the profile icon.
 *
 * Reads the wallet balance, not the stamp card's progress — see stampContext.
 */
export default function StampBalancePill() {
    const { balance, loading } = useStamps();
    const scale = useSharedValue(1);
    const previous = useRef(balance);

    useEffect(() => {
        // Pop only on an increase. Shrinking (once spending exists) should not feel like a reward.
        if (balance > previous.current) {
            scale.value = withSequence(
                withSpring(1.25, { damping: 7, stiffness: 220 }),
                withSpring(1, { damping: 12 }),
            );
        }
        previous.current = balance;
    }, [balance, scale]);

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Animated.View style={[styles.pill, animatedStyle]}>
            <StampIcon color="#fff" size={18} />
            <Text style={styles.count} accessibilityLabel={`${balance} stamps available`}>
                {loading ? '–' : balance}
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1.5,
        borderColor: '#ffd9f9',
    },
    count: {
        color: '#fff',
        fontFamily: Fonts.Lato_Bold,
        fontSize: 18,
        letterSpacing: 0.5,
        minWidth: 12,
        textAlign: 'center',
    },
});
