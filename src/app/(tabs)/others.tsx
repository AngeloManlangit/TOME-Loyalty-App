import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { Colors, bgTransparency } from "../../constants/theme";

export default function OthersScreen() {

  return (
    <View style={styles.container}>
      <LinearGradient
          colors={['#fff', `${Colors.outlets.orange}${bgTransparency}`]}
          style={styles.mainView}
      >
          <Text>MAP</Text>
      </LinearGradient>
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
  }
});
