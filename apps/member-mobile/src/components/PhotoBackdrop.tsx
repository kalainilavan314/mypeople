import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

/**
 * The sage design's soft photographic page: a blurred lake-and-palmyra photo under a pale veil, so
 * frosted cards and text stay easy to read. Only Home, Events and Gallery use it; forms, identity,
 * staff and settings screens keep the plain page (owner's choice of the design, 18 November 2026).
 */
export function PhotoBackdrop() {
  return (
    <View style={styles.fill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Image
        source={require('../../assets/backgrounds/lake-soft.jpg')}
        style={styles.fill}
        resizeMode="cover"
        accessible={false}
        importantForAccessibility="no"
      />
      <LinearGradient
        colors={['rgba(238, 247, 240, 0.49)', 'rgba(250, 251, 249, 0.45)', 'rgba(250, 251, 249, 0.85)']}
        locations={[0, 0.35, 1]}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
});
