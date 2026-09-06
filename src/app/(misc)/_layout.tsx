import { UserProvider } from "@/src/contexts/userContext";
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function RootLayout() {
    return(
        <UserProvider>
            <View style={styles.container}>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="addStamp" />
                    <Stack.Screen name="createAcc" />
                </Stack>
            </View>
        </UserProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
    }
})