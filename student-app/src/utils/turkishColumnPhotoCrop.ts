/**
 * Türkçe sütun önizleme çerçevesi ile aynı mantıkta kırpım (ScanScreen ile paylaşılır).
 */
import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { getTurkishColumnOverlayFrame } from '../screens/scan/TurkishColumnScanOverlay';

export type ViewportSize = { width: number; height: number };

export function getImageSizeAsync(uri: string): Promise<ViewportSize> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

export function getCenteredCoverCropRect(
  imageSize: ViewportSize,
  viewportSize: ViewportSize,
  frameSize: ViewportSize
): { originX: number; originY: number; width: number; height: number } | null {
  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0 ||
    frameSize.width <= 0 ||
    frameSize.height <= 0
  ) {
    return null;
  }

  const scale = Math.max(
    viewportSize.width / imageSize.width,
    viewportSize.height / imageSize.height
  );
  const displayedWidth = imageSize.width * scale;
  const displayedHeight = imageSize.height * scale;
  const offsetX = Math.max(0, (displayedWidth - viewportSize.width) / 2);
  const offsetY = Math.max(0, (displayedHeight - viewportSize.height) / 2);
  const frameX = (viewportSize.width - frameSize.width) / 2;
  const frameY = (viewportSize.height - frameSize.height) / 2;

  const originX = Math.max(0, Math.round((offsetX + frameX) / scale));
  const originY = Math.max(0, Math.round((offsetY + frameY) / scale));
  const width = Math.min(
    imageSize.width - originX,
    Math.max(1, Math.round(frameSize.width / scale))
  );
  const height = Math.min(
    imageSize.height - originY,
    Math.max(1, Math.round(frameSize.height / scale))
  );

  if (width <= 1 || height <= 1) {
    return null;
  }

  return { originX, originY, width, height };
}

export async function cropTurkishColumnPhoto(
  photoUri: string,
  imageSize: ViewportSize,
  viewportSize: ViewportSize
): Promise<string> {
  const frameSize = getTurkishColumnOverlayFrame(viewportSize.width, viewportSize.height);
  const cropRect = getCenteredCoverCropRect(imageSize, viewportSize, frameSize);
  if (!cropRect) {
    return photoUri;
  }

  const result = await manipulateAsync(photoUri, [{ crop: cropRect }], {
    compress: 0.95,
    format: SaveFormat.JPEG,
  });

  return result.uri;
}
