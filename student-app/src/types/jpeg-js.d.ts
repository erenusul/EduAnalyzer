declare module 'jpeg-js' {
  export interface DecodeResult {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export function decode(
    jpegData: Uint8Array,
    options?: { useTArray?: boolean; formatAsRGBA?: boolean; tolerantDecoding?: boolean }
  ): DecodeResult;
}
