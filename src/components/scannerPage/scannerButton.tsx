import { Image, View, StyleSheet } from "react-native";
import { Colors } from "../../constants/theme";

export default function ScannerButton() {
  return (
    <View style={styles.container}>

        <Image resizeMethod="scale" resizeMode="cover" style={styles.buttonLayout} source={require('@/assets/images/outlets-percent-logo.png')} />
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        padding: 11,
        backgroundColor: Colors.outlets.purple,
        flex: 1,
        borderRadius: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        marginBottom: 30
    },
    buttonLayout: {
        width: 70,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden'
    }
});
