import { auth } from "@/firebase/firebaseConfig";
import { Fonts, Colors, bgTransparency } from "@src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { getAuth } from 'firebase/auth'
import { router } from "expo-router";
import { useUser } from "@/src/contexts/userContext";
import ProfileCard from "@/src/components/profile/profileCard";

export default function OthersScreen() {

  const { user } = useUser();

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
          
          <View style={styles.cardContainer}>
            {
              user ? (
                <ProfileCard
                  id={user.id}
                  username={user.username}
                  email={user.email}
                  contact_no={user.contact_no}
                  first_name={user.first_name}
                  middle_name={user.middle_name}
                  last_name={user.last_name}
                  profile_img_url={user.profile_img_url}
                  birth_date={user.birth_date}
                  card_background_color={user.card_background_color}
                />
              ) : ('')
            }
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
    gap: 60,
    alignItems: 'center'
  },
  cardContainer: {
    width: '95%'
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
