import { Image, View, StyleSheet, TouchableOpacity } from "react-native";
import type { Brand } from "@/assets/classes/maps";

const brands: Brand[] = [
    {
        brand_id: 0,
        name: 'Crocs',
        logo: 'https://1000logos.net/wp-content/uploads/2018/12/Crocs-logo.png'
    },
    {
        brand_id: 1,
        name: 'New Era',
        logo: 'https://logos-world.net/wp-content/uploads/2023/01/New-Era-Logo-1997.png'
    },
    {
        brand_id: 2,
        name: 'Nike',
        logo: 'https://www.nicepng.com/png/detail/3-36806_nike-logo-png-nike-logo-png-red.png'
    },
    {
        brand_id: 3,
        name: 'Adidas',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Adidas_logo.png'
    },
    {
        brand_id: 4,
        name: 'Levi\'s',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Levi%27s_logo.svg/3840px-Levi%27s_logo.svg.png'
    },
    {
        brand_id: 5,
        name: 'Casio',
        logo: 'https://images.seeklogo.com/logo-png/2/3/casio-logo-png_seeklogo-26977.png'
    }
]

export default function BrandsList() {
    const brandButtons = [];

    for (const b of brands) {
        brandButtons.push(
            <TouchableOpacity style={styles.brandButton} key={b.brand_id}>
                <Image source={{ uri: b.logo }} style={styles.logoImage} resizeMode="contain" onError={(e) => console.log(`Failed to load ${b.name}: ${e.nativeEvent.error}`)} />
            </TouchableOpacity>
        )
    }

    return (
        <View style={styles.gridContainer}>
            {brandButtons}
        </View>
    );
}

const styles = StyleSheet.create({
    gridContainer: {
        padding: 15,
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',    
        justifyContent: 'flex-start',
        alignItems: 'center',
        alignContent: 'space-evenly'
    },
    brandButton: {
        width: 100,
        margin: 10,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ff1ff1'
    },
    logoImage: {
        width: '100%',
        height: '100%'
    }
})