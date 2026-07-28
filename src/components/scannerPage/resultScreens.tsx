import type { ClaimResult, ReceiptError, RejectCode } from "@/assets/classes/receipts";
import { Colors, Fonts } from "@src/constants/theme";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";



interface RejectCopy {
    title: string;
    body: string;
    retryLabel: string;
}

const REJECT_COPY: Record<RejectCode, RejectCopy> = {
    INVOICE_DUPLICATE: {
        title: "Already claimed",
        body: "This receipt has been used for a stamp before. Each receipt can only be claimed once.",
        retryLabel: "SCAN ANOTHER",
    },
    DATE_EXPIRED: {
        title: "Receipt too old",
        body: "Receipts can be claimed within 7 days of purchase. This one is past that.",
        retryLabel: "SCAN ANOTHER",
    },
    DATE_FUTURE: {
        title: "Date looks wrong",
        body: "This receipt is dated in the future, so we cannot claim it yet.",
        retryLabel: "TRY AGAIN",
    },
    RATE_LIMITED: {
        title: "Daily limit reached",
        body: "You have scanned the maximum number of receipts for today. Come back tomorrow.",
        retryLabel: "DONE",
    },
    SESSION_EXPIRED: {
        title: "Scan expired",
        body: "This scan timed out. Please photograph the receipt again — it only takes a moment.",
        retryLabel: "RETAKE PHOTO",
    },
    LOW_CONFIDENCE: {
        title: "Could not read it clearly",
        body: "We are not sure enough about what this receipt says to award a stamp. Try again with more light and the receipt flat.",
        retryLabel: "RETAKE PHOTO",
    },
    AMBIGUOUS_FIELD: {
        title: "Could not tell which is which",
        body: "This photo has more than one possible match for a detail we need. Try again with just the receipt in frame.",
        retryLabel: "RETAKE PHOTO",
    },
    IMAGE_UNCLEAR: {
        title: "Photo is too blurry",
        body: "Hold the phone steady and make sure the receipt is in focus before taking the photo.",
        retryLabel: "RETAKE PHOTO",
    },
    MERCHANT_NOT_ACCREDITED: {
        title: "Store not in the programme",
        body: "This store is not part of the rewards programme yet.",
        retryLabel: "SCAN ANOTHER",
    },
    ACCN_NOT_ACCREDITED: {
        title: "Receipt not recognised",
        body: "This receipt is not from an accredited point-of-sale system.",
        retryLabel: "SCAN ANOTHER",
    },
    OCR_NO_TEXT: {
        title: "Could not read it",
        body: "We could not find any text. Try again with more light and the receipt flat.",
        retryLabel: "TRY AGAIN",
    },
    NOT_A_RECEIPT: {
        title: "That is not a receipt",
        body: "We could not find receipt details in this photo. Make sure the whole receipt is in frame.",
        retryLabel: "TRY AGAIN",
    },
    INVOICE_MISSING: {
        title: "Missing invoice number",
        body: "We could not find an invoice number. Try again with the top of the receipt in frame.",
        retryLabel: "TRY AGAIN",
    },
    INVOICE_MALFORMED: {
        title: "Invoice number looks wrong",
        body: "That invoice number does not match the expected format.",
        retryLabel: "TRY AGAIN",
    },
    MIN_MISSING: {
        title: "Missing machine number",
        body: "We could not find the machine number (MIN). It is usually near the top of the receipt.",
        retryLabel: "TRY AGAIN",
    },
    MIN_MALFORMED: {
        title: "Machine number looks wrong",
        body: "That machine number does not match the expected format.",
        retryLabel: "TRY AGAIN",
    },
    DATE_MISSING: {
        title: "Missing date",
        body: "We could not find a date on this receipt.",
        retryLabel: "TRY AGAIN",
    },
    DATE_UNPARSEABLE: {
        title: "Date looks wrong",
        body: "We could not make sense of the date on this receipt.",
        retryLabel: "TRY AGAIN",
    },
    ACCN_MISSING: {
        title: "Missing ACCN",
        body: "We could not find the ACCN on this receipt.",
        retryLabel: "TRY AGAIN",
    },
    ACCN_MALFORMED: {
        title: "ACCN looks wrong",
        body: "That ACCN does not match the expected format.",
        retryLabel: "TRY AGAIN",
    },
    RECEIPT_KEY_INVALID: {
        title: "Could not read it clearly",
        body: "We could not read this receipt's details clearly enough to claim it.",
        retryLabel: "TRY AGAIN",
    },
};

const FALLBACK: RejectCopy = {
    title: "Something went wrong",
    body: "We could not claim this receipt. Please try again.",
    retryLabel: "TRY AGAIN",
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
export function ResultSuccess({ result, onDone }: { result: ClaimResult; onDone: () => void }) {
    const scale = useSharedValue(0.4);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSequence(withSpring(1.12, { damping: 8 }), withSpring(1, { damping: 12 }));
        opacity.value = withTiming(1, { duration: 260 });
    }, [scale, opacity]);

    const badgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    // The badge shows the WALLET, not the card. A claim adds an unspent stamp; putting it on the
    // card is a separate, deliberate action the user takes later.
    const { balance } = result;

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.badge, badgeStyle]}>
                <Text style={styles.badgeCount}>{balance}</Text>
                <Text style={styles.badgeTotal}>{balance === 1 ? "stamp" : "stamps"}</Text>
            </Animated.View>

            <Text style={styles.title}>Stamp earned</Text>
            <Text style={styles.body}>
                {balance === 1
                    ? "You have 1 stamp ready to use."
                    : `You have ${balance} stamps ready to use.`}
            </Text>

            <Pressable style={styles.primaryButton} onPress={onDone}>
                <Text style={styles.primaryButtonText}>SCAN ANOTHER</Text>
            </Pressable>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
export function ResultRejected({ error, onRetry }: { error: ReceiptError; onRetry: () => void }) {
    const copy = error.code ? (REJECT_COPY[error.code] ?? FALLBACK) : FALLBACK;
    const duplicate = error.code === "INVOICE_DUPLICATE";

    return (
        <View style={styles.container}>
            <View style={[styles.iconCircle, duplicate ? styles.iconInfo : styles.iconWarn]}>
                <Text style={styles.iconGlyph}>{duplicate ? "!" : "?"}</Text>
            </View>

            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>

            {}
            {!error.code && error.message.length > 0 && (
                <Text style={styles.diagnostic} selectable>
                    {error.message}
                </Text>
            )}

            <Pressable style={styles.primaryButton} onPress={onRetry}>
                <Text style={styles.primaryButtonText}>{copy.retryLabel}</Text>
            </Pressable>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
export function ResultOffline({ onRetry }: { onRetry: () => void }) {
    return (
        <View style={styles.container}>
            <View style={[styles.iconCircle, styles.iconOffline]}>
                <Text style={styles.iconGlyph}>~</Text>
            </View>

            <Text style={styles.title}>No connection</Text>
            <Text style={styles.body}>
                Scanning needs an internet connection. Your receipt has not been used — reconnect and try
                again.
            </Text>

            <Pressable style={styles.primaryButton} onPress={onRetry}>
                <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 34,
        paddingBottom: 70,
    },
    badge: {
        width: 132,
        height: 132,
        borderRadius: 66,
        backgroundColor: Colors.outlets.purple,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 26,
    },
    badgeCount: {
        fontFamily: Fonts.Montserrat,
        fontSize: 46,
        color: "#fff",
        lineHeight: 52,
    },
    badgeTotal: {
        fontFamily: Fonts.Lato,
        fontSize: 14,
        color: "#ffffffCC",
        letterSpacing: 1,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },
    iconInfo: { backgroundColor: `${Colors.outlets.blue}22` },
    iconWarn: { backgroundColor: `${Colors.outlets.orange}22` },
    iconOffline: { backgroundColor: "#E0E1E6" },
    iconGlyph: {
        fontFamily: Fonts.Montserrat,
        fontSize: 42,
        color: Colors.outlets.purple,
    },
    title: {
        fontFamily: Fonts.Montserrat,
        fontSize: 24,
        color: Colors.outlets.purple,
        textAlign: "center",
        marginBottom: 10,
    },
    body: {
        fontFamily: Fonts.Lato,
        fontSize: 15,
        lineHeight: 22,
        color: Colors.light.textSecondary,
        textAlign: "center",
        marginBottom: 32,
    },
    diagnostic: {
        fontFamily: Fonts.Lato,
        fontSize: 12,
        lineHeight: 17,
        color: Colors.light.textSecondary,
        textAlign: "center",
        backgroundColor: "#F0F0F3",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: -18,
        marginBottom: 26,
    },
    primaryButton: {
        backgroundColor: Colors.outlets.purple,
        paddingVertical: 15,
        paddingHorizontal: 44,
        borderRadius: 50,
    },
    primaryButtonText: {
        color: "#fff",
        fontFamily: Fonts.Lato_Bold,
        fontSize: 16,
        letterSpacing: 1.2,
    },
});
