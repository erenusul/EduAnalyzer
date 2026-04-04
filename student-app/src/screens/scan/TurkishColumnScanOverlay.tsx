import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { turkishColumnCropAspectRatio } from '../../constants/opticalTurkishColumn';

export type TurkishColumnScanOverlayProps = {
  accentColor: string;
  /** Kamera önizleme alanına sığdırılacak maksimum genişlik (px). */
  layoutMaxWidth: number;
  /** Kamera önizleme yüksekliği (px). */
  cameraViewportHeight: number;
};

export type TurkishColumnOverlayFrame = {
  width: number;
  height: number;
};

export function getTurkishColumnOverlayFrame(
  layoutMaxWidth: number,
  cameraViewportHeight: number
): TurkishColumnOverlayFrame {
  const aspect = turkishColumnCropAspectRatio();
  const maxH = cameraViewportHeight * 0.9;
  const maxW = layoutMaxWidth * 0.94;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return { width: w, height: h };
}

/**
 * Türkçe sütun kırpıntısı için mm modeli en-boy oranında yalnızca dış çerçeve — satır/şık rehberi yok (formla hizası tutmuyordu).
 */
export function TurkishColumnScanOverlay({
  accentColor,
  layoutMaxWidth,
  cameraViewportHeight,
}: TurkishColumnScanOverlayProps) {
  const frameStyle = useMemo(
    () => getTurkishColumnOverlayFrame(layoutMaxWidth, cameraViewportHeight),
    [layoutMaxWidth, cameraViewportHeight]
  );

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
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});
