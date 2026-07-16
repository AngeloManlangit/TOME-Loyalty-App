import { Text, View, StyleSheet } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>HEY POOKIES</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#45ab5a",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
