import { Image, View, StyleSheet, Text, ScrollView, StatusBar } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { bgTransparency, Colors } from "../constants/theme";
import StampSection from "../components/homePage/stampSection";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#fff', `${Colors.outlets.pink}${bgTransparency}`]}
        style={styles.mainView}
      >
        <StampSection />
        
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
    paddingVertical: 30,
    paddingHorizontal: 20
  }
});
