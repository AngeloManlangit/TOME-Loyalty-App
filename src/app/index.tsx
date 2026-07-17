import { Text, View, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";

import { NavigationContainer } from "expo-router/build/react-navigation";

export default function Index() {
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.header} barStyle={"light-content"} />
      
      <SafeAreaView style={styles.mainView}>
        <Text>PPOOP</Text>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  mainView: {
    flex: 1,
    justifyContent: "flex-start",
  },
  header: {
    backgroundColor: Colors.header,
    width: "100%",
    height: 50,
    justifyContent: "space-between"
  }
});
