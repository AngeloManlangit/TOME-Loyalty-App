import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function RootLayout() {
    return(
        <View style={styles.container}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="addStamp" />
                <Stack.Screen name="createAcc" />
            </Stack>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
    }
})