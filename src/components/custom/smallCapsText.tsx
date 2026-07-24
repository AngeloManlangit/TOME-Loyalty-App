import { StyleSheet, Text } from 'react-native';

interface SmallCapsInterface {
    children?: any;
    style?: any;
    baseSize?: number;
}

export const SmallCapsText = ({ children, style, baseSize = 16 }: SmallCapsInterface) => {
    if (typeof children !== 'string') {
        return <Text style={[styles.baseText, style]}>{children}</Text>;
    }

    return (
        <Text style={[styles.baseText, style]}>
        {children.split('').map((char, index) => {

            const isLowercase = char === char.toLowerCase() && char !== char.toUpperCase();

            return (
            <Text
                key={index}
                style={{
                
                fontSize: isLowercase ? baseSize * 0.85 : baseSize,
                textTransform: 'uppercase',
                }}
            >
                {char}
            </Text>
            );
        })}
        </Text>
    );
};

const styles = StyleSheet.create({
    baseText: {
        letterSpacing: 0.5,                  // Subtle spacing aids small-cap legibility
    },
});