import { Colors, Fonts } from "@src/constants/theme";
import { StyleSheet, Text, View } from "react-native";


export default function ReceiptGuideOverlay({ hint }: { hint?: string }) {
    return (
        <View style={styles.container} pointerEvents="none">
            <View style={styles.frame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
            </View>

            <Text style={styles.hint}>{hint ?? "Fit the whole receipt inside the frame"}</Text>
        </View>
    );
}

const CORNER = 36;
const THICKNESS = 4;

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    frame: {
        width: "82%",
        // Receipts are tall and narrow; matching that shape makes "fill the frame" produce a capture
        // where the text is large enough to read.
        aspectRatio: 0.62,
        maxHeight: "70%",
    },
    corner: {
        position: "absolute",
        width: CORNER,
        height: CORNER,
        borderColor: "#fff",
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: THICKNESS,
        borderLeftWidth: THICKNESS,
        borderTopLeftRadius: 10,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: THICKNESS,
        borderRightWidth: THICKNESS,
        borderTopRightRadius: 10,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: THICKNESS,
        borderLeftWidth: THICKNESS,
        borderBottomLeftRadius: 10,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: THICKNESS,
        borderRightWidth: THICKNESS,
        borderBottomRightRadius: 10,
    },
    hint: {
        position: "absolute",
        bottom: 130,
        color: "#fff",
        fontFamily: Fonts.Lato,
        fontSize: 15,
        letterSpacing: 0.4,
        textAlign: "center",
        paddingHorizontal: 30,
        paddingVertical: 8,
        backgroundColor: `${Colors.outlets.purple}CC`,
        borderRadius: 20,
        overflow: "hidden",
    },
});
