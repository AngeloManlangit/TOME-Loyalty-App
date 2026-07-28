import type { FieldCandidate, ReceiptFieldName } from "@/assets/classes/receipts";
import { Colors, Fonts } from "@src/constants/theme";
import type { ScannerApi } from "@src/features/receipts/useScanner";
import { FIELD_LABELS, REVIEWABLE_FIELDS } from "@src/features/receipts/useScanner";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";



interface Props {
    scanner: ScannerApi;
    candidates: Record<ReceiptFieldName, FieldCandidate[]>;
    submitting: boolean;
}

export default function ReviewFields({ scanner, candidates, submitting }: Props) {
    const anythingFlagged = REVIEWABLE_FIELDS.some((f) => scanner.isFlagged(f));

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Check the details</Text>
                <Text style={styles.subtitle}>
                    {anythingFlagged
                        ? "We could not read everything clearly. Please confirm or fix the highlighted fields."
                        : "Tap any value to correct it before claiming your stamp."}
                </Text>

                {REVIEWABLE_FIELDS.map((field) => {
                    const flagged = scanner.isFlagged(field);
                    const value = scanner.valueOf(field);
                    const alternates = (candidates[field] ?? [])
                        .filter((c) => c.value !== value)
                        .slice(0, 3);

                    return (
                        <View key={field} style={styles.field}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>{FIELD_LABELS[field]}</Text>
                                {flagged && (
                                    <View style={styles.flag}>
                                        <Text style={styles.flagText}>CHECK</Text>
                                    </View>
                                )}
                            </View>

                            <TextInput
                                style={[styles.input, flagged && styles.inputFlagged]}
                                value={value}
                                onChangeText={(text) => scanner.setField(field, text)}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                placeholder={
                                    field === "receipt_date" ? "YYYY-MM-DD" : "Not found — please enter"
                                }
                                placeholderTextColor="#B0B4BA"
                                editable={!submitting}
                                removeClippedSubviews={false}
                            />

                            {alternates.length > 0 && (
                                <View style={styles.chipRow}>
                                    <Text style={styles.chipHint}>Did you mean</Text>
                                    {alternates.map((candidate) => (
                                        <Pressable
                                            key={`${field}-${candidate.value}`}
                                            style={styles.chip}
                                            disabled={submitting}
                                            onPress={() => scanner.setField(field, candidate.value)}
                                        >
                                            <Text style={styles.chipText}>{candidate.value}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            <View style={styles.actions}>
                <Pressable
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

                <Pressable onPress={() => scanner.reset()} disabled={submitting}>
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
    labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    label: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 13,
        letterSpacing: 0.8,
        color: Colors.light.textSecondary,
        textTransform: "uppercase",
    },
    flag: {
        backgroundColor: `${Colors.outlets.orange}22`,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    flagText: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 10,
        letterSpacing: 0.8,
        color: Colors.outlets.orange,
    },
    input: {
        borderWidth: 1.5,
        borderColor: "#E0E1E6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: Fonts.Lato,
        fontSize: 17,
        color: Colors.light.text,
        backgroundColor: "#fff",
    },
    inputFlagged: { borderColor: Colors.outlets.orange },
    chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 },
    chipHint: {
        fontFamily: Fonts.Lato,
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    chip: {
        backgroundColor: `${Colors.outlets.purple}12`,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    chipText: {
        fontFamily: Fonts.Lato,
        fontSize: 13,
        color: Colors.outlets.purple,
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
