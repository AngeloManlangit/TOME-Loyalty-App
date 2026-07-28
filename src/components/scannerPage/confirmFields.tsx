import type { ReceiptFieldName } from "@/assets/classes/receipts";
import { Colors, Fonts } from "@src/constants/theme";
import type { ScannerApi } from "@src/features/receipts/useScanner";
import { CONFIRMED_FIELDS, FIELD_LABELS } from "@src/features/receipts/useScanner";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";



interface Props {
    scanner: ScannerApi;
    submitting: boolean;
}

/**
 * Read-only confirmation of what the OCR read.
 *
 * Values are rendered as text, not inputs — there is no way to edit them, by design. Everything
 * shown here cleared the server's confidence gates; a field it was unsure about never reaches this
 * screen, it comes back as a reject code and the user retakes the photo.
 */
export default function ConfirmFields({ scanner, submitting }: Props) {
    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.title}>Check the details</Text>
                <Text style={styles.subtitle}>
                    Make sure these match your receipt. If anything looks wrong, retake the photo.
                </Text>

                {CONFIRMED_FIELDS.map((field: ReceiptFieldName) => (
                    <View key={field} style={styles.field}>
                        <Text style={styles.label}>{FIELD_LABELS[field]}</Text>
                        <View style={styles.valueBox}>
                            <Text style={styles.value} selectable>
                                {scanner.valueOf(field)}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                    onPress={() => scanner.submit()}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryButtonText}>CLAIM STAMP</Text>
                    )}
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    onPress={() => scanner.reset()}
                    disabled={submitting}
                >
                    <Text style={styles.secondaryText}>RETAKE PHOTO</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 24, paddingBottom: 12 },
    title: {
        fontFamily: Fonts.Montserrat,
        fontSize: 24,
        color: Colors.outlets.purple,
        marginBottom: 6,
    },
    subtitle: {
        fontFamily: Fonts.Lato,
        fontSize: 14,
        lineHeight: 20,
        color: Colors.light.textSecondary,
        marginBottom: 24,
    },
    field: { marginBottom: 22 },
    label: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 13,
        letterSpacing: 0.8,
        color: Colors.light.textSecondary,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    valueBox: {
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: Colors.light.backgroundElement,
    },
    value: {
        fontFamily: Fonts.Lato,
        fontSize: 17,
        color: Colors.light.text,
        letterSpacing: 0.4,
    },
    actions: {
        paddingHorizontal: 24,
        paddingBottom: 90,
        paddingTop: 8,
        gap: 14,
        alignItems: "center",
    },
    primaryButton: {
        backgroundColor: Colors.outlets.purple,
        paddingVertical: 15,
        borderRadius: 50,
        width: "100%",
        alignItems: "center",
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: {
        color: "#fff",
        fontFamily: Fonts.Lato_Bold,
        fontSize: 16,
        letterSpacing: 1.2,
    },
    secondaryText: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 14,
        letterSpacing: 1,
        color: Colors.light.textSecondary,
    },
});
