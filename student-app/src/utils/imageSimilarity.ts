/**
 * Küçük gri imza + benzerlik (0 = farklı, 1 = aynı).
 * jpeg-js ile decode; Expo ortamında çalışır.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

const DEFAULT_SIZE = 32;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function rgbaToGrayscaleNormalized(data: Uint8Array, width: number, height: number): Float32Array {
  const n = width * height;
  const out = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < data.length && j < n; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    out[j] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    j += 1;
  }
  return out;
}

/**
 * URI → 32×32 JPEG → gri vektör [0,1].
 */
export async function computeGrayscaleFingerprint(
  imageUri: string,
  size: number = DEFAULT_SIZE
): Promise<Float32Array> {
  const resized = await manipulateAsync(
    imageUri,
    [{ resize: { width: size, height: size } }],
    { compress: 1, format: SaveFormat.JPEG }
  );

  const b64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToUint8Array(b64);
  const decoded = decode(bytes, { useTArray: true });
  const { width, height, data } = decoded;
  if (width !== size || height !== size) {
    throw new Error(`Beklenen ${size}x${size}, gelen: ${width}x${height}`);
  }
  return rgbaToGrayscaleNormalized(data, width, height);
}

/**
 * Ortalama mutlak fark (0–1 ölçeğinde piksel değerleri).
 * similarity = 1 - meanAbsDiff
 */
export function similarityFromFingerprints(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += Math.abs(a[i] - b[i]);
  }
  const meanAbs = sum / a.length;
  return Math.max(0, Math.min(1, 1 - meanAbs));
}

/**
 * Eşik: similarity >= threshold ise neredeyse aynı kare (duplicate).
 * Örn. threshold 0.90 → ortalama mutlak fark ~0.10’un altında sayılır.
 */
export function isDuplicateFrame(
  prev: Float32Array | null,
  next: Float32Array,
  threshold: number
): boolean {
  if (prev === null) {
    return false;
  }
  const sim = similarityFromFingerprints(prev, next);
  return sim >= threshold;
}
