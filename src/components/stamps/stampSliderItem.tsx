import { StampCardDetails } from '@/assets/classes/stamps';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import StampCard from './stampCard';
import { SharedValue } from 'react-native-reanimated';

interface ItemProps {
    item: StampCardDetails;
    chosenStamp: (stamp: StampCardDetails) => void;
}

export default function StampSliderItem({item, chosenStamp}: ItemProps) {    
    return (
      <TouchableOpacity onPress={() => chosenStamp(item)}>
        <StampCard cardDetails={item}  />
      </TouchableOpacity>
    );
}