import { StampCardDetails } from "@/assets/classes/stamps";
import StampCard from "@/src/components/stamps/stampCard";
import { stampService } from "@/src/services/stampService";
import { Colors, Fonts, bgTransparency } from "@src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function CollectionScreen() {
  const [stamps, setStamps] = useState<StampCardDetails[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadStamps = async () => {
      setLoading(true);
      const userStamps = await stampService.fetchStamps();
      if (userStamps) {
        // console.log(userStamps) // debug purposes
        setStamps(userStamps);
      }

      setLoading(false);
    };

    loadStamps();
  }, []);

  const stampList = [];

  for (const s of stamps) {
      stampList.push(
        <TouchableOpacity key={s.id} style={[styles.cardButtonContainer]} activeOpacity={0.8} onPress={() => console.log(s.stampCard_configs.title)}>
          <View style={styles.cardContainer}>
            <StampCard cardDetails={s} />

            <Text style={styles.stampCaption}>{s.stampCard_configs.title}</Text>
          </View>
        </TouchableOpacity>
      )
    }

  return (
    <View style={styles.container}>
      <LinearGradient
          colors={['#fff', `${Colors.outlets.green}${bgTransparency}`]}
          style={styles.mainView}
      >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.headerText}>Stamp Cards</Text>
            <View style={styles.gridContainer}>
              {stampList}
            </View>
          </ScrollView>
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
  },
  scrollContent: {
    paddingVertical: 30,
    flexGrow: 1,
    alignItems: 'center'
  },
  headerText: {
    fontFamily: Fonts.Montserrat,
    fontSize: 32,
    textTransform: 'uppercase'
  },
  gridContainer: {
      padding: 5,
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',    
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20
  },
  cardButtonContainer: {
    marginTop: 10,
    width: '50%',
  },
  cardContainer: {
    alignItems: 'center'
  },
  stampCaption: {
    marginVertical: 12,
    fontFamily: Fonts.Lato,
    fontSize: 12,
  }
});
