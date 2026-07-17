import { Image, View, StyleSheet, StatusBar, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.mainView}>
        <Text>Colletion</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#7246b9",
    flex: 1,
  },
  mainView: {
    flex: 1,
  }
});
