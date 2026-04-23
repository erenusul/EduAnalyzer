/**
 * Yerel dataset kaydı (backend / submitScan yok).
 *
 * - Dataset Mode: duplicate kontrolü, ipucu, Türkçe sütun kırpımı (ekran tarafı).
 *   Flag: `datasetModeEnabled` / `EXPO_PUBLIC_DATASET_MODE_ENABLED`
 * - Dataset Collector: hızlı tam kare kayıt, `source: dataset_collector` metadata.
 *   Flag: `datasetCollectorEnabled` / `EXPO_PUBLIC_DATASET_COLLECTOR_ENABLED`
 */

import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import JSZip from 'jszip';
import * as Sharing from 'expo-sharing';

import { computeGrayscaleFingerprint, isDuplicateFrame } from '../../utils/imageSimilarity';

export const DATASET_DIR_NAME = 'dataset';

export type DatasetHintKey = 'left' | 'right' | 'near' | 'far' | 'light';

export interface DatasetSampleMetadata {
  timestamp: string;
  device: string;
  hint: DatasetHintKey;
  saved: boolean;
}

/** Hızlı fotoğraf biriktirme (DatasetCollectorScreen); sunucuya istek yok. */
export interface DatasetCollectorMetadata {
  timestamp: string;
  saved: boolean;
  device: string;
  source: 'dataset_collector';
}

export type SaveDatasetSampleResult =
  | { saved: false; reason: 'disabled' | 'duplicate' | 'no_document_directory' | 'write_failed'; message?: string }
  | {
      saved: true;
      runId: string;
      runDirectoryUri: string;
      imageUri: string;
      metadataUri: string;
    };

let lastFingerprint: Float32Array | null = null;

/** Ekran her açıldığında ardışık duplicate karşılaştırmasını sıfırlar. */
export function clearDatasetDuplicateSession(): void {
  lastFingerprint = null;
}

function getExtra(): Record<string, unknown> | undefined {
  return Constants.expoConfig?.extra as Record<string, unknown> | undefined;
}

export function isDatasetModeEnabled(): boolean {
  const extra = getExtra()?.datasetModeEnabled;
  if (extra === true || extra === 'true' || extra === 1 || extra === '1') {
    return true;
  }
  const env = process.env.EXPO_PUBLIC_DATASET_MODE_ENABLED;
  return env === 'true' || env === '1';
}

export function isDatasetCollectorEnabled(): boolean {
  const extra = getExtra()?.datasetCollectorEnabled;
  if (extra === true || extra === 'true' || extra === 1 || extra === '1') {
    return true;
  }
  const env = process.env.EXPO_PUBLIC_DATASET_COLLECTOR_ENABLED;
  return env === 'true' || env === '1';
}

export function getDatasetSimilarityThreshold(): number {
  const raw = process.env.EXPO_PUBLIC_DATASET_SIMILARITY_THRESHOLD;
  if (raw === undefined || raw === '') {
    return 0.9;
  }
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) {
    return 0.9;
  }
  return n;
}

export function getDatasetFingerprintSize(): number {
  const raw = process.env.EXPO_PUBLIC_DATASET_FINGERPRINT_SIZE;
  if (raw === undefined || raw === '') {
    return 32;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 8 || n > 128) {
    return 32;
  }
  return n;
}

export function getDatasetRootUri(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    return '';
  }
  return `${base}${DATASET_DIR_NAME}/`;
}

/** Ekranlarda gösterim: kayıt ve ZIP kaynağının gerçekten `dataset/` olduğunu doğrulamak için. */
export function getDatasetStorageDebugInfo(): {
  documentDatasetRootUri: string;
  savedImageFileName: string;
  zipContainsTopFolder: string;
} {
  return {
    documentDatasetRootUri: getDatasetRootUri(),
    savedImageFileName: 'image.jpg',
    zipContainsTopFolder: DATASET_DIR_NAME,
  };
}

export type ShareDatasetExportResult =
  | { ok: true; generatedZipCacheUri: string; exportPackedFromDocumentUri: string; zipContainsTopFolder: string }
  | { ok: false; message: string };

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

function buildDeviceLabel(): string {
  const parts = [
    Device.osName ?? 'unknown-os',
    Device.modelName ?? 'unknown-model',
    Application.nativeApplicationVersion ?? '',
  ].filter(Boolean);
  return parts.join(' | ');
}

export type SaveDatasetCollectorResult =
  | { saved: false; reason: 'disabled' | 'no_document_directory' | 'write_failed'; message?: string }
  | {
      saved: true;
      runId: string;
      runDirectoryUri: string;
      imageUri: string;
      metadataUri: string;
    };

/**
 * Tam kare fotoğrafı anında dataset altında run_<timestamp> klasörüne kopyalar (duplicate yok, kırpım yok).
 */
export async function saveDatasetCollectorSample(photoUri: string): Promise<SaveDatasetCollectorResult> {
  if (!isDatasetCollectorEnabled()) {
    return { saved: false, reason: 'disabled' };
  }

  const root = getDatasetRootUri();
  if (!root) {
    return { saved: false, reason: 'no_document_directory', message: 'documentDirectory yok' };
  }

  try {
    await ensureDir(root);
    const runId = buildRunId();
    const runDir = `${root}${runId}/`;
    await ensureDir(runDir);

    const destImage = `${runDir}image.jpg`;
    await FileSystem.copyAsync({ from: photoUri, to: destImage });

    const ts = new Date().toISOString();
    const meta: DatasetCollectorMetadata = {
      timestamp: ts,
      saved: true,
      device: buildDeviceLabel(),
      source: 'dataset_collector',
    };
    const metadataUri = `${runDir}metadata.json`;
    await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(meta, null, 2), {
      encoding: 'utf8',
    });

    await appendDatasetManifest(root, { run_id: runId, created_at: ts, source: 'dataset_collector' });
    console.log('[DatasetCollector] saved:', runDir);

    return {
      saved: true,
      runId,
      runDirectoryUri: runDir,
      imageUri: destImage,
      metadataUri,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[DatasetCollector] save failed', message);
    return { saved: false, reason: 'write_failed', message };
  }
}

export async function saveDatasetSample(
  photoUri: string,
  hint: DatasetHintKey
): Promise<SaveDatasetSampleResult> {
  if (!isDatasetModeEnabled()) {
    return { saved: false, reason: 'disabled' };
  }

  const root = getDatasetRootUri();
  if (!root) {
    return { saved: false, reason: 'no_document_directory', message: 'documentDirectory yok' };
  }

  const threshold = getDatasetSimilarityThreshold();
  const fpSize = getDatasetFingerprintSize();

  try {
    const fp = await computeGrayscaleFingerprint(photoUri, fpSize);
    if (lastFingerprint !== null && isDuplicateFrame(lastFingerprint, fp, threshold)) {
      console.log('[DatasetMode] duplicate frame skipped');
      return { saved: false, reason: 'duplicate' };
    }

    await ensureDir(root);
    const runId = buildRunId();
    const runDir = `${root}${runId}/`;
    await ensureDir(runDir);

    const destImage = `${runDir}image.jpg`;
    await FileSystem.copyAsync({ from: photoUri, to: destImage });

    const ts = new Date().toISOString();
    const meta: DatasetSampleMetadata = {
      timestamp: ts,
      device: buildDeviceLabel(),
      hint,
      saved: true,
    };
    const metadataUri = `${runDir}metadata.json`;
    await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(meta, null, 2), {
      encoding: 'utf8',
    });

    await appendDatasetManifest(root, { run_id: runId, created_at: ts, hint, source: 'dataset_mode' });

    lastFingerprint = fp;
    console.log('[DatasetMode] saved new sample');

    return {
      saved: true,
      runId,
      runDirectoryUri: runDir,
      imageUri: destImage,
      metadataUri,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[DatasetMode] save failed', message);
    return { saved: false, reason: 'write_failed', message };
  }
}

export interface DatasetRunSummary {
  run_id: string;
  directory_uri: string;
}

interface DatasetManifestEntry {
  run_id: string;
  created_at: string;
  hint?: DatasetHintKey;
  source?: 'dataset_mode' | 'dataset_collector';
}

interface DatasetManifestFile {
  version: 1;
  entries: DatasetManifestEntry[];
}

async function appendDatasetManifest(root: string, entry: DatasetManifestEntry): Promise<void> {
  const path = `${root}manifest.json`;
  let manifest: DatasetManifestFile = { version: 1, entries: [] };
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw) as DatasetManifestFile;
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

/** Base64 → ham bayt (JSZip’e binary olarak verilir; iç içe klasör API’sinden kaçınılır). */
function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function listDatasetRuns(): Promise<DatasetRunSummary[]> {
  const root = getDatasetRootUri();
  if (!root) {
    return [];
  }
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists || !info.isDirectory) {
    return [];
  }
  const names = await FileSystem.readDirectoryAsync(root);
  const out: DatasetRunSummary[] = [];
  for (const name of names) {
    if (name.startsWith('run_')) {
      out.push({ run_id: name, directory_uri: `${root}${name}/` });
    }
  }
  out.sort((a, b) => b.run_id.localeCompare(a.run_id));
  return out;
}

export async function buildDatasetZipArchive(): Promise<string | null> {
  const root = getDatasetRootUri();
  if (!root) {
    return null;
  }
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    return null;
  }
  const runs = await listDatasetRuns();
  if (runs.length === 0) {
    return null;
  }

  const zip = new JSZip();

  for (const run of runs) {
    const prefix = `${DATASET_DIR_NAME}/${run.run_id}/`;
    const imgPath = `${run.directory_uri}image.jpg`;
    const metaPath = `${run.directory_uri}metadata.json`;
    const imgInfo = await FileSystem.getInfoAsync(imgPath);
    if (imgInfo.exists) {
      const b64 = await FileSystem.readAsStringAsync(imgPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      zip.file(`${prefix}image.jpg`, decodeBase64ToUint8Array(b64));
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
    zip.file(`${DATASET_DIR_NAME}/manifest.json`, txt);
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  const cache = FileSystem.cacheDirectory;
  if (!cache) {
    return null;
  }
  const outName = `dataset_export_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.zip`;
  const outUri = `${ensureTrailingSlash(cache)}${outName}`;
  await FileSystem.writeAsStringAsync(outUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outUri;
}

export async function shareDatasetExport(): Promise<ShareDatasetExportResult> {
  const exportPackedFromDocumentUri = getDatasetRootUri();
  const uri = await buildDatasetZipArchive();
  if (!uri) {
    return { ok: false, message: 'Dışa aktarılacak örnek bulunamadı (dataset/ altında run_* yok).' };
  }
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    return { ok: false, message: 'Paylaşım kullanılamıyor. ZIP: ' + uri };
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/zip',
    dialogTitle: 'dataset/ klasörü (image.jpg)',
  });
  return {
    ok: true,
    generatedZipCacheUri: uri,
    exportPackedFromDocumentUri,
    zipContainsTopFolder: DATASET_DIR_NAME,
  };
}
