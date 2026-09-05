import { StampCardDetails } from "@/assets/classes/stamps";
import StampCard from "@/src/components/stamps/stampCard";
import StampPopupDetails from "@/src/components/stamps/stampPopupDetails";
import { stampService } from "@/src/services/stampService";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Colors, Fonts, bgTransparency } from "@src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function CollectionScreen() {
  const [stamps, setStamps] = useState<StampCardDetails[]>([]);
  
  const handleRefresh = async () => {
    const userStamps = await stampService.fetchStamps();
    if (userStamps) {
      setStamps(userStamps);
    }
  };

  useEffect(() => {
    stampService.fetchStamps().then((userStamps) => {
      if (userStamps) {
        setStamps(userStamps);
      }
    });
  }, []);

  const stampList = [];

  // stamp popup
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%', '100%'], []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop disappearsOnIndex={-1} appearsOnIndex={0} {...props} />, []
  );

  const [selectedStamp, setSelectedStamp] = useState<StampCardDetails | null>(null);
  function setCurrentStamp(s: StampCardDetails) {
    console.log(s.id)
    setSelectedStamp(s);
    bottomSheetRef.current?.snapToIndex(0);
  }

  for (const s of stamps) {
      stampList.push(
        <TouchableOpacity key={s.id} style={[styles.cardButtonContainer]} activeOpacity={0.8} onPress={() => setCurrentStamp(s)}>
          <View style={styles.cardContainer}>
            <StampCard cardDetails={s} />

            <Text style={styles.stampCaption}>{s.stampCard_configs.title}</Text>
          </View>
        </TouchableOpacity>
      )
    }

  return (
    <GestureHandlerRootView style={styles.container}>
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

      <BottomSheet
          ref={bottomSheetRef}
          index={-1} // -1 means it starts fully hidden off-screen
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderBackdrop}
      >
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
              {selectedStamp && (
                  <StampPopupDetails 
                    stamp={selectedStamp}
                    onRefresh={() => {
                      handleRefresh();
                      bottomSheetRef.current?.close();
                    }}  
                  />
              )}
          </BottomSheetScrollView>
      </BottomSheet>
    </GestureHandlerRootView>
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
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginTop: 20,
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
  },
  sheetContent: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
  },
});
