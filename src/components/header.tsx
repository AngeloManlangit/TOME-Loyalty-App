import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/theme";

export default function CustomHeader() {
    return (
        <View style={styles.header}>
          <Text> Hi poopies </Text>
        </View>
    );
};

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
