import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";

interface ModalPopupInterface {
    children?: any;
    snapPoints: any;
    style?: any;
    renderBackdrop: any;
}

/*
Requires { GestureHandlerRootView } from "react-native-gesture-handler"; as an outer view for this to work
*/
export default function ModalPopup({children, snapPoints, style, renderBackdrop}: ModalPopupInterface) {

    const bottomSheetRef = useRef<BottomSheet>(null);


    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1} // -1 means it starts fully hidden off-screen
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
        >
          <BottomSheetScrollView contentContainerStyle={style}>
              {children}
          </BottomSheetScrollView>
        </BottomSheet>
    );
}


