import { Image, View, StyleSheet } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Tywin_Lannister_Profile_Charles_Dance.jpg/250px-Tywin_Lannister_Profile_Charles_Dance.jpg" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#e47bc2",
    flex: 1,
  }
});