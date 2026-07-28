import { StampCardDetails } from '@/assets/classes/stamps';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import StampCard from './stampCard';
import { SharedValue } from 'react-native-reanimated';

interface ItemProps {
    item: StampCardDetails;
    index: number;
    scrollX: SharedValue<number>;
}

export default function StampSliderItem({item, index, scrollX}: ItemProps) {    
    return (
      <View>
        <StampCard cardDetails={item} />
      </View>
    );
}