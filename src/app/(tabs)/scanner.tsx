import { View, Text, StyleSheet } from "react-native";
import { Colors, Fonts } from "@src/constants/theme";

export default function ScannerScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Scanner</Text>
            <Text style={styles.subtitle}>Coming soon.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontFamily: Fonts.Lato_Bold,
        color: Colors.outlets.purple,
        textTransform: 'uppercase',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 6,
    },
});
