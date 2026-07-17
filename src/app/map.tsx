import { Image, View, StyleSheet, StatusBar, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";

export default function Home() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.mainView}>
        <Text>Map</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#56e1c3",
    flex: 1,
  },
  mainView: {
    flex: 1,
  }
});
