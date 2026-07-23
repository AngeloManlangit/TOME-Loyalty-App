import { Image, View, StyleSheet } from "react-native";
import { Colors } from "../../constants/theme";

const buttonSize: number = 80;

export default function ScannerButton() {
    
    return (
        <View style={styles.container}>
            <Image resizeMethod="scale" resizeMode="cover" style={styles.buttonLayout} source={require('@/assets/images/outlets-percent-logo.png')} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 9,
        backgroundColor: Colors.outlets.purple,
        flex: 1,
        borderRadius: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        marginBottom: 35
    },
    buttonLayout: {
        width: buttonSize,
        height: buttonSize,
        borderRadius: buttonSize / 2,
        overflow: 'hidden'
    }
});
