import { Image, View, StyleSheet, Text, ScrollView, StatusBar } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Image style={styles.mainView} source={{ uri: "https://media.tenor.com/bDmyKRMnKMcAAAAM/like-cat.gif" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fdff6f",
    flex: 1,
  },
  mainView: {
    flex: 1,
  }
});
