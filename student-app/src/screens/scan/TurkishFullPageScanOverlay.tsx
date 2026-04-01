import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { lgsTurkishA4AspectRatio } from '../../constants/opticalTurkishA4';

export type TurkishFullPageScanOverlayProps = {
  accentColor: string;
  layoutMaxWidth: number;
  cameraViewportHeight: number;
};

/**
 * A4 (212×300 mm) en-boy oranında yalnızca dış çerçeve — iç detay yok (formlar farklı; sabit köşe/şık rehberi yanıltıcıydı).
 */
export function TurkishFullPageScanOverlay({
  accentColor,
  layoutMaxWidth,
  cameraViewportHeight,
}: TurkishFullPageScanOverlayProps) {
  const frameStyle = useMemo(() => {
    const aspect = lgsTurkishA4AspectRatio();
    const maxH = cameraViewportHeight * 0.92;
    const maxW = layoutMaxWidth * 0.96;
    let h = maxH;
    let w = h * aspect;
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    return { width: w, height: h };
  }, [layoutMaxWidth, cameraViewportHeight]);

  return (
    <View style={styles.centerFill} pointerEvents="none">
      <View style={[styles.frame, frameStyle, { borderColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
