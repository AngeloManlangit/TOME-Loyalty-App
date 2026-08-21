import { StampCardDetails } from '@/assets/classes/stamps';
import { TouchableOpacity } from 'react-native'
import StampCard from './stampCard';

interface ItemProps {
    item: StampCardDetails;
    chosenStamp: (stamp: StampCardDetails) => void;
}

export default function StampSliderItem({item, chosenStamp}: ItemProps) {    
    return (
      <TouchableOpacity style={{padding: 10}} onPress={() => chosenStamp(item)}>
        <StampCard cardDetails={item}  />
      </TouchableOpacity>
    );
}