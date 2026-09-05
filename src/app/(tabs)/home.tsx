import { StampCardDetails } from "@/assets/classes/stamps";
import ShareStampModal from "@/src/components/stamps/shareStamp";
import StampPopupDetails from "@/src/components/stamps/stampPopupDetails";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import StampSection from "@src/components/homePage/stampSection";
import { bgTransparency, Colors } from "@src/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Linking, Image, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function HomeScreen() {
  const handleAdPress = async () => {
    const url = 'https://www.facebook.com/TheOutletsMez2Estate';
    
    // Check if the device can handle the URL scheme
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(`Don't know how to open this URL: ${url}`);
    }
  };

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

  const [showShareModal, setShowShareModal] = useState(false);
  const handleSharePress = (response: boolean) => {
    setShowShareModal(response);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient
        colors={['#fff', `${Colors.outlets.pink}${bgTransparency}`]}
        style={styles.mainView}
      >
        <StampSection chosenStamp={setCurrentStamp} />

        <TouchableOpacity onPress={handleAdPress}>
          <Image 
            source={{ uri: 'https://scontent.fmnl17-5.fna.fbcdn.net/v/t39.99422-6/764833155_940450489097168_3070133556105380496_n.png?stp=dst-png&cstp=mx2278x1000&ctp=s2278x1000&_nc_cat=102&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=cc71e4&_nc_eui2=AeFoDcVL0QAUfQok0J8BPnVXJmtcnpVGMpYma1yelUYylj9aiBtv9LFxStj7S7hGQ_iFaPxQSKWYKUe7sd11PYim&_nc_ohc=gZqtdNhKa24Q7kNvwHmUu1X&_nc_oc=AdpoQaN3pMu5KOXGfUJg8pMj4-0ST69Nkq3Xd6m6udnIjtWonk_6A2ls3J66FdaiFeU&_nc_zt=14&_nc_ht=scontent.fmnl17-5.fna&_nc_gid=14_Nkm3H4qldyyRb64EvCA&_nc_ss=7a2a8&oh=00_AQH47frbeOA6IaqqppBkTyv9dJE_eufT0kSk55XOpT6MqA&oe=6A8C480A' }} 
            style={styles.adImage}  
          />
        </TouchableOpacity>

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
                      onSharePress={handleSharePress}
                    />
                )}
            </BottomSheetScrollView>
        </BottomSheet>
      </LinearGradient>
                
      {
        selectedStamp && (
          <ShareStampModal
            s={selectedStamp}
            visible={showShareModal}
            onClose={() => setShowShareModal(false)}
          />
        )
      }
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  mainView: {
    flex: 1,
    paddingVertical: 30,
  },
  adImage: {
    width: '100%',
    height: 'auto',
    aspectRatio: 2.7 / 1
  },
  sheetContent: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
  },
});
