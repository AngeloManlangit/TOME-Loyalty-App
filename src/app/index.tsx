import { Image, View, StyleSheet, Text, ScrollView, StatusBar } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { bgTransparency, Colors } from "../constants/theme";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#fff', `${Colors.outlets.pink}${bgTransparency}`]}
        style={styles.mainView}
      >

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
