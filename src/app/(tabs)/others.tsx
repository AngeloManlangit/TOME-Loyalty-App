import { auth } from "@/firebase/firebaseConfig";
import { Colors, bgTransparency } from "@src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { getAuth } from 'firebase/auth'
import { router } from "expo-router";

export default function OthersScreen() {

  getAuth().onAuthStateChanged((user) => {
    if (!user) router.replace('/');
  })

  return (
    <View style={styles.container}>
      <LinearGradient
          colors={['#fff', `${Colors.outlets.orange}${bgTransparency}`]}
          style={styles.mainView}
      >
          <TouchableOpacity onPress={() => auth.signOut()}>
              <Text>Sign Out</Text>
          </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  mainView: {
    flex: 1,
  }
});
