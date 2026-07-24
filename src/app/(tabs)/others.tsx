import { auth } from "@/firebase/firebaseConfig";
import { Fonts, Colors, bgTransparency } from "@src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { getAuth } from 'firebase/auth'
import { router } from "expo-router";
import { useUser } from "@/src/contexts/userContext";

export default function OthersScreen() {

  const { user, loading } = useUser();

  getAuth().onAuthStateChanged((user) => {
    if (!user) router.replace('/');
  })

  return (
    <View style={styles.container}>
      <LinearGradient
          colors={['#fff', `${Colors.outlets.orange}${bgTransparency}`]}
          style={styles.mainView}
      > 
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileContainer}>
            <Image 
                source={(user) ? { uri: user?.profile_img_url } : require('@/assets/images/fallbackUserProfile.png')} 
                style={styles.profileImage} 
            />

            <Text style={styles.nameText}>{user?.first_name} {user?.middle_name.at(0)}. {user?.last_name}</Text>
            <Text style={styles.usernameText}>@{user?.username}</Text>
          </View>

          <View style={styles.optionsView}>
            <TouchableOpacity style={styles.optionsButtonContainer} onPress={() => console.log('poop')}>
              <Text style={styles.optionsText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionsButtonContainer} onPress={() => auth.signOut()}>
              <Text style={[styles.optionsText, styles.signOutText]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    paddingVertical: 40,
    flexGrow: 1,
    gap: 60
  },
  profileContainer: {
    alignItems: 'center',
  },
  profileImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderColor: '#ffd9f9',
    borderWidth: 6,
  },
  nameText: {
    marginTop: 13,
    fontFamily: Fonts.Montserrat,
    fontSize: 21
  },
  usernameText: {
    fontFamily: Fonts.Lato,
    fontSize: 15,
    color: '#777777'
  },
  optionsView: {
    flex: 1,
    width: "100%",
    alignItems: 'flex-start',
  },
  optionsButtonContainer: {
    width: "100%",
    borderColor: '#c7c7c7',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20
  },
  optionsText: {
    fontFamily: Fonts.Lato,
    fontSize: 18
  },
  signOutText: {
    color: '#b80f0f'
  }
});
