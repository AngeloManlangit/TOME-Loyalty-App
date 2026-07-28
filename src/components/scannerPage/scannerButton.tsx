import { Colors } from "@src/constants/theme";
import { useScannerUi } from "@src/features/receipts/scannerUiContext";
import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const buttonSize: number = 80;

/**
 * The tab-bar FAB, which doubles as the camera shutter.
 *
 * Off the scanner it is the app's logo button. On the scanner it morphs into a shutter ring — the
 * same physical button, so there is no second shutter competing with it on screen.
 */
export default function ScannerButton() {
    const { mode } = useScannerUi();

    const onScanner = mode === 'ready' || mode === 'busy';

    // 0 = logo, 1 = shutter. Everything below is driven off this one value so the two states cannot
    // drift apart mid-animation. `onScanner` is a plain JS value, so it must be declared as a
    // dependency — without it the worklet keeps the value captured on first render.
    const progress = useDerivedValue(
        () => withSpring(onScanner ? 1 : 0, { damping: 15, stiffness: 140 }),
        [onScanner],
    );

    // Separate from `progress` because dimming is a fade, not a spring — springing opacity
    // overshoots past 1 and flickers.
    const dim = useDerivedValue(
        () => withTiming(mode === 'inactive' ? 0.35 : 1, { duration: 200 }),
        [mode],
    );

    const containerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.value, [0, 1], [Colors.outlets.purple, '#fff']),
        borderWidth: interpolate(progress.value, [0, 1], [0, 4]),
        opacity: dim.value,
    }));

    const logoStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.6], [1, 0], 'clamp'),
        transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.7]) }],
    }));

    const ringStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp'),
        transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) }],
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.centred, logoStyle]}>
                <Image
                    resizeMethod="scale"
                    resizeMode="cover"
                    style={styles.buttonLayout}
                    source={require('@/assets/images/outlets-percent-logo.png')}
                />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, styles.centred, ringStyle]}>
                {mode === 'busy' ? (
                    <ActivityIndicator color={Colors.outlets.purple} />
                ) : (
                    <View style={styles.shutterInner} />
                )}
            </Animated.View>
        </Animated.View>
    );
}

/**
 * Press feedback, applied by the tab button rather than here so the whole touch target reacts.
 * Exported as a hook so the pressed state lives with the press handler.
 */
export function useShutterPressStyle(pressed: boolean) {
    const scale = useDerivedValue(
        () => withSpring(pressed ? 0.88 : 1, { damping: 12, stiffness: 400 }),
        [pressed],
    );
    return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/** Full-screen white flash on capture, so the shutter has a visible consequence. */
export function CaptureFlash({ trigger }: { trigger: number }) {
    // A shared value, not derived: this one is written imperatively when a capture fires.
    const flash = useSharedValue(0);

    useEffect(() => {
        if (trigger === 0) return;
        flash.value = 1;
        flash.value = withTiming(0, { duration: 320 });
    }, [trigger, flash]);

    const style = useAnimatedStyle(() => ({ opacity: flash.value }));

    return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, style]} />;
}

const styles = StyleSheet.create({
    container: {
        padding: 9,
        flex: 1,
        borderRadius: 100,
        borderColor: `${Colors.outlets.purple}AA`,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        marginBottom: 35,
        width: buttonSize + 18,
        height: buttonSize + 18,
    },
    centred: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonLayout: {
        width: buttonSize,
        height: buttonSize,
        borderRadius: buttonSize / 2,
        overflow: 'hidden',
    },
    shutterInner: {
        width: buttonSize - 22,
        height: buttonSize - 22,
        borderRadius: (buttonSize - 22) / 2,
        backgroundColor: Colors.outlets.purple,
    },
    flash: {
        backgroundColor: '#fff',
        zIndex: 20,
    },
});
