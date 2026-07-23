import StampSection from "@src/components/homePage/stampSection";
import { bgTransparency, Colors } from "@src/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from "react-native";

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
