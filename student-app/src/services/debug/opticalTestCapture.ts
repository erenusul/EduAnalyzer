/**
 * Türkçe sütun optik tarama test verilerini yerel dosya sistemine kaydetme (yalnızca debug).
 *
 * Flag açılışı (öncelik):
 * 1) app.json `expo.extra.opticalTestSaveEnabled === true`
 * 2) aksi halde `EXPO_PUBLIC_OPTICAL_TEST_SAVE_ENABLED === 'true' | '1'`
 *
 * ScanScreen’de gerçek kayıt yalnızca şu anda: `isOpticalTestSaveEnabled() && scanMode === 'turkishColumn'`
 * ve gönderim sonrası `saveOpticalTestCapture` çağrısı ile yapılır (tam sayfa modunda çağrılmaz).
 */

import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import JSZip from 'jszip';
import * as Sharing from 'expo-sharing';

import type { ScanExamResponse } from '../../types/exam';

/** Uygulama bellek dizininde kök klasör adı (tam yol documentDirectory altında). */
export const OPTICAL_TESTS_DIR_NAME = 'optical_tests';

export type OpticalScanModeTag = 'turkish_column' | 'full_page';

export interface OpticalTestCaptureMetadata {
  /** Kayıt klasörüne göre göreli yol (örn. optical_tests/run_xxx/scan.jpg) */
  image_path: string;
  /** ISO 8601 */
  timestamp: string;
  exam_id: string;
  /** API ile gönderilen şablon kimliği (örn. lgs_turkish_column_crop) */
  template: string;
  question_count: number;
  option_count: number;
  scan_mode: OpticalScanModeTag;
  /** Başarılı API yanıtı */
  scan_result?: ScanExamResponse | null;
  /** Başarısız istek veya beklenmeyen hata */
  error?: {
    message: string;
    status?: number;
  };
  /** Kayıt dizini kimliği (klasör adı) */
  run_id: string;
}

function getExtra(): Record<string, unknown> | undefined {
  return Constants.expoConfig?.extra as Record<string, unknown> | undefined;
}

/**
 * Yerel test kaydı açık mı?
 * Öncelik: app.json `expo.extra.opticalTestSaveEnabled === true`, aksi halde
 * EXPO_PUBLIC_OPTICAL_TEST_SAVE_ENABLED === 'true' | '1'
 */
export function isOpticalTestSaveEnabled(): boolean {
  const extra = getExtra()?.opticalTestSaveEnabled;
  if (extra === true) {
    return true;
  }
  const env = process.env.EXPO_PUBLIC_OPTICAL_TEST_SAVE_ENABLED;
  return env === 'true' || env === '1';
}

/** Flag’in nereden açıldığını doğrulama / debug için. */
export type OpticalTestSaveFlagSource = 'app.json extra' | 'EXPO_PUBLIC env' | 'off';

export interface OpticalTestSaveFlagStatus {
  enabled: boolean;
  source: OpticalTestSaveFlagSource;
}

/**
 * `isOpticalTestSaveEnabled()` ile aynı mantık; hangi koşulun geçerli olduğunu açıkça döner.
 */
export function getOpticalTestSaveFlagStatus(): OpticalTestSaveFlagStatus {
  const extra = getExtra()?.opticalTestSaveEnabled;
  if (extra === true) {
    return { enabled: true, source: 'app.json extra' };
  }
  const env = process.env.EXPO_PUBLIC_OPTICAL_TEST_SAVE_ENABLED;
  if (env === 'true' || env === '1') {
    return { enabled: true, source: 'EXPO_PUBLIC env' };
  }
  return { enabled: false, source: 'off' };
}

export type SaveOpticalTestCaptureResult =
  | { saved: false; reason: 'disabled' | 'no_document_directory' | 'write_failed'; message?: string }
  | {
      saved: true;
      runId: string;
      /** run klasörü (file://), sonda / */
      runDirectoryUri: string;
      scanFileUri: string;
      metadataFileUri: string;
    };

export function getOpticalTestsRootUri(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    return '';
  }
  return `${base}${OPTICAL_TESTS_DIR_NAME}/`;
}

function ensureTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

async function ensureDir(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

function buildRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SaveOpticalTestCaptureParams {
  examId: string;
  /** Kırpılmış veya seçilmiş görüntü (file://) */
  photoUri: string;
  opticalTemplate: string;
  questionCount: number;
  optionCount: number;
  scanMode: OpticalScanModeTag;
  scanResult?: ScanExamResponse | null;
  error?: { message: string; status?: number };
}

/**
 * Görseli kopyalar ve metadata.json yazar.
 * Hata durumunda tarama akışını bozmaz; sonucu döner ve console’a yazar (ScanScreen).
 */
export async function saveOpticalTestCapture(
  params: SaveOpticalTestCaptureParams
): Promise<SaveOpticalTestCaptureResult> {
  if (!isOpticalTestSaveEnabled()) {
    return { saved: false, reason: 'disabled' };
  }

  const root = getOpticalTestsRootUri();
  if (!root) {
    return { saved: false, reason: 'no_document_directory', message: 'FileSystem.documentDirectory yok' };
  }

  try {
    await ensureDir(root);
    const runId = buildRunId();
    const runDir = `${root}${runId}/`;
    await ensureDir(runDir);

    const destImage = `${runDir}scan.jpg`;
    await FileSystem.copyAsync({ from: params.photoUri, to: destImage });

    const relImage = `${OPTICAL_TESTS_DIR_NAME}/${runId}/scan.jpg`;
    const ts = new Date().toISOString();

    const meta: OpticalTestCaptureMetadata = {
      image_path: relImage,
      timestamp: ts,
      exam_id: params.examId,
      template: params.opticalTemplate,
      question_count: params.questionCount,
      option_count: params.optionCount,
      scan_mode: params.scanMode,
      run_id: runId,
      scan_result: params.scanResult ?? null,
      error: params.error,
    };

    const metadataFileUri = `${runDir}metadata.json`;
    await FileSystem.writeAsStringAsync(metadataFileUri, JSON.stringify(meta, null, 2), {
      encoding: 'utf8',
    });

    await appendManifest(root, {
      run_id: runId,
      created_at: ts,
      exam_id: params.examId,
      template: params.opticalTemplate,
    });

    return {
      saved: true,
      runId,
      runDirectoryUri: runDir,
      scanFileUri: destImage,
      metadataFileUri,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { saved: false, reason: 'write_failed', message };
  }
}

interface ManifestEntry {
  run_id: string;
  created_at: string;
  exam_id: string;
  template: string;
}

interface ManifestFile {
  version: 1;
  entries: ManifestEntry[];
}

function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function appendManifest(root: string, entry: ManifestEntry): Promise<void> {
  const path = `${root}manifest.json`;
  let manifest: ManifestFile = { version: 1, entries: [] };
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw) as ManifestFile;
      if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
        manifest = parsed;
      }
    }
  } catch {
    manifest = { version: 1, entries: [] };
  }
  manifest.entries.unshift(entry);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(manifest, null, 2), { encoding: 'utf8' });
}

export interface OpticalTestRunSummary {
  run_id: string;
  directory_uri: string;
}

/**
 * optical_tests altındaki run_* klasörlerini listeler.
 */
export async function listOpticalTestRuns(): Promise<OpticalTestRunSummary[]> {
  const root = getOpticalTestsRootUri();
  if (!root) {
    return [];
  }
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists || !info.isDirectory) {
    return [];
  }
  const names = await FileSystem.readDirectoryAsync(root);
  const out: OpticalTestRunSummary[] = [];
  for (const name of names) {
    if (name.startsWith('run_')) {
      out.push({ run_id: name, directory_uri: `${root}${name}/` });
    }
  }
  out.sort((a, b) => b.run_id.localeCompare(a.run_id));
  return out;
}

/**
 * Tüm kayıtları ZIP üretir; dosya URI döner (paylaşım veya kopyalama için).
 */
export async function buildOpticalTestsZipArchive(): Promise<string | null> {
  const root = getOpticalTestsRootUri();
  if (!root) {
    return null;
  }
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    return null;
  }

  const runs = await listOpticalTestRuns();
  if (runs.length === 0) {
    return null;
  }

  const zip = new JSZip();

  for (const run of runs) {
    const prefix = `${OPTICAL_TESTS_DIR_NAME}/${run.run_id}/`;
    const imgPath = `${run.directory_uri}scan.jpg`;
    const metaPath = `${run.directory_uri}metadata.json`;
    const imgInfo = await FileSystem.getInfoAsync(imgPath);
    if (imgInfo.exists) {
      const b64 = await FileSystem.readAsStringAsync(imgPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      zip.file(`${prefix}scan.jpg`, decodeBase64ToUint8Array(b64));
    }
    const metaInfo = await FileSystem.getInfoAsync(metaPath);
    if (metaInfo.exists) {
      const txt = await FileSystem.readAsStringAsync(metaPath);
      zip.file(`${prefix}metadata.json`, txt);
    }
  }

  const manifestPath = `${root}manifest.json`;
  const manInfo = await FileSystem.getInfoAsync(manifestPath);
  if (manInfo.exists) {
    const txt = await FileSystem.readAsStringAsync(manifestPath);
    zip.file(`${OPTICAL_TESTS_DIR_NAME}/manifest.json`, txt);
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  const cache = FileSystem.cacheDirectory;
  if (!cache) {
    return null;
  }
  const outName = `optical_tests_export_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.zip`;
  const outUri = `${ensureTrailingSlash(cache)}${outName}`;
  await FileSystem.writeAsStringAsync(outUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outUri;
}

/**
 * ZIP oluşturup paylaşım sayfasını açar (dosya uygulaması / AirDrop vb.).
 */
export async function shareOpticalTestsExport(): Promise<{ ok: boolean; message?: string }> {
  const uri = await buildOpticalTestsZipArchive();
  if (!uri) {
    return { ok: false, message: 'Dışa aktarılacak kayıt bulunamadı.' };
  }
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    return {
      ok: false,
      message: 'Bu cihazda paylaşım kullanılamıyor. ZIP yolu: ' + uri,
    };
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/zip',
    dialogTitle: 'optical_tests/ (scan.jpg)',
  });
  return { ok: true };
}
