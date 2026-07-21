import { View, StyleSheet, Text, Image, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Fonts, bgTransparency } from "../constants/theme";
import BrandsList from "../components/mapPage/brands";
import type { Brand } from "@/assets/classes/maps";
import { useState, useRef, useMemo, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";

export default function MapsScreen() {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  function setBrand(b: Brand) {
    console.log(b.name)
    setSelectedBrand(b);
    bottomSheetRef.current?.snapToIndex(0);
  }

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '75%', '95%'], []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop appearsOnIndex={1} disappearsOnIndex={0} {...props} />, []
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient
          colors={['#fff', `${Colors.outlets.blue}${bgTransparency}`]}
          style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image style={styles.logoImage} source={require('@/assets/images/TOME Colored.png')} resizeMode="contain" />

          <Image style={styles.image} source={require('@/assets/images/TOME-MAP.png')} resizeMode="contain" />

          <Text style={styles.brandsTitle}>Available Brands</Text>

          <BrandsList chosenBrand={setBrand} />
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
              {selectedBrand && (
                  <>
                      {/* Assuming your brand logo is a local require() based on our previous setup */}
                      <Image source={selectedBrand.logo} style={styles.modalLogo} resizeMode="contain" />
                      <Text style={styles.modalTitle}>{selectedBrand.name}</Text>
                  </>
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
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 30,
    flexGrow: 1,
    alignItems: 'center'
  },
  logoImage: {
    height: 80,
    marginBottom: 10
  },
  image: {
    width: '100%',
    height: 'auto',
    aspectRatio: 16 / 9
  },
  brandsTitle: {
    fontSize: 28,
    fontFamily: Fonts.Montserrat,
    textTransform: 'uppercase',
    marginTop: 40,
  },
  sheetContent: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  modalLogo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  }
});
