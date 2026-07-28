import { router } from "expo-router";
import { ChevronLeftIcon } from "lucide-react-native";
import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
    /** Runs before leaving, to drop any in-flight scan. */
    onExit?: () => void;
}

/**
 * Top-left exit from the scanner.
 *
 * The header is hidden on this route, so this is the only way back other than the tab bar. Present
 * in every phase — including the result screens — because it is the escape hatch.
 */
export default function ExitChevron({ onExit }: Props) {
    const insets = useSafeAreaInsets();

    const leave = () => {
        onExit?.();
        // The scanner is reachable as a first screen (a cold start onto this tab), where back() is
        // a no-op and would strand the user on the camera.
        if (router.canGoBack()) router.back();
        else router.replace('/home');
    };

    // The hardware back button must do the same thing, or Android users get a different exit that
    // skips the state reset.
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            leave();
            return true;
        });
        return () => subscription.remove();
    });

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            onPress={leave}
            style={[styles.button, { top: insets.top + 8 }]}
            // Generous hit area: the visible glyph is smaller than a comfortable touch target.
            hitSlop={12}
        >
            <ChevronLeftIcon color="#fff" size={28} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        position: 'absolute',
        left: 12,
        zIndex: 30,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
});
