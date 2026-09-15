import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File as DeviceFile, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { dedupeRequest } from '@/lib/dedupe';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Private file storage (`send2u-private` bucket).
 *
 * Conventions: helper QR lives at `qr/<uid>/<timestamp>[_<name>].<ext>`,
 * payment evidence at `evidence/<uid>/<orderId>_<timestamp>[_<name>].<ext>`
 * (`[_<name>]` is the sanitized original filename, present for new uploads;
 * older objects without it keep working). Unique paths per upload —
 * replacement means uploading a new object and (best-effort) removing the
 * old one, never `upsert`. Only Storage paths/references are stored in the
 * database; file bytes never touch a table.
 */

export const PAYMENT_BUCKET = 'send2u-private';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export interface PickedImage {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  /** Original filename as reported by the picker (fallback when absent). */
  name: string;
  sizeBytes: number;
  /** Local URI for pre-upload preview. Never uploaded or persisted. */
  uri: string;
}

/** A payment receipt file: PDF or a common receipt image. */
export interface PickedReceipt {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  /** Original full filename as reported by the document picker. */
  fileName: string;
  sizeBytes: number;
  /** Local URI for pre-upload preview. Never uploaded or persisted. */
  uri: string;
}

type Uploadable = Pick<PickedReceipt, 'bytes' | 'mimeType'>;

/** MIME types accepted for payment receipts. */
const RECEIPT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function receiptExtensionFor(mimeType: string, fileName: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  if (mimeType === 'image/jpeg') return 'jpg';
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  return 'bin';
}

/**
 * Opens the system image library for a single photo. Returns null when the
 * user cancels. Throws a friendly error on denial/failure.
 */
export async function pickPaymentImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is needed to attach this image. Allow it and try again.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || asset.type !== 'image') throw new Error('Please choose a photo image.');
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!mimeType.startsWith('image/')) throw new Error('Please choose a photo image.');
  const bytes = await assetToBytes(asset.uri, asset.file);
  if (bytes.byteLength === 0) throw new Error('That photo could not be read. Try another one.');
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('That photo is too large. Pick one under 5 MB.');
  }
  return {
    bytes,
    mimeType,
    extension: extensionFor(mimeType),
    name: asset.fileName ?? 'qr-photo.jpg',
    sizeBytes: asset.fileSize ?? bytes.byteLength,
    uri: asset.uri,
  };
}

async function assetToBytes(uri: string, file: File | undefined): Promise<Uint8Array> {
  if (typeof file !== 'undefined') {
    return new Uint8Array(await file.arrayBuffer());
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error('That file could not be read. Try another one.');
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Opens the system file picker for a single payment receipt (PDF or common
 * receipt image). Returns null when the user cancels. Throws a friendly
 * error on failure. The helper QR flow keeps using the image library.
 */
export async function pickReceiptFile(): Promise<PickedReceipt | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: RECEIPT_MIME_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No file was chosen. Try again.');
  const mimeType = asset.mimeType ?? 'application/octet-stream';
  if (!RECEIPT_MIME_TYPES.includes(mimeType)) {
    throw new Error('Please choose a PDF or a photo receipt (JPG, PNG, WEBP, HEIC).');
  }
  const bytes = await assetToBytes(asset.uri, asset.file);
  if (bytes.byteLength === 0) throw new Error('That file could not be read. Try another one.');
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    throw new Error('That file is too large. Pick one under 10 MB.');
  }
  return {
    bytes,
    mimeType,
    extension: receiptExtensionFor(mimeType, asset.name),
    fileName: asset.name,
    sizeBytes: asset.size ?? bytes.byteLength,
    uri: asset.uri,
  };
}

/**
 * Sanitizes an original filename into a safe Storage path stem (no
 * separators, no leading dots, capped length). Readability is preserved;
 * exotic characters collapse to `-`.
 */
function safePathStem(originalName: string): string {
  const withoutExt = originalName.split('/').pop()?.split('.').slice(0, -1).join('.') ?? '';
  const cleaned = (withoutExt || 'file').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  const trimmed = cleaned.replace(/^[.-]+|[.-]+$/g, '') || 'file';
  return trimmed.slice(0, 60);
}

/** Storage path for a fresh helper QR upload. */
export function qrPathFor(userId: string, extension: string, originalName?: string): string {
  const suffix = originalName ? `_${safePathStem(originalName)}` : '';
  return `qr/${userId}/${Date.now()}${suffix}.${extension}`;
}

/** Storage path for a fresh profile-avatar upload. */
export function avatarPathFor(userId: string, extension: string): string {
  return `avatar/${userId}/${Date.now()}.${extension}`;
}

/**
 * Opens the system image library for a single profile photo. Square crop
 * on native; returns null when the user cancels. Throws a friendly error
 * on denial/failure.
 */
export async function pickAvatarImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is needed to change your photo. Allow it and try again.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || asset.type !== 'image') throw new Error('Please choose a photo image.');
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!mimeType.startsWith('image/')) throw new Error('Please choose a photo image.');
  const bytes = await assetToBytes(asset.uri, asset.file);
  if (bytes.byteLength === 0) throw new Error('That photo could not be read. Try another one.');
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('That photo is too large. Pick one under 5 MB.');
  }
  return {
    bytes,
    mimeType,
    extension: extensionFor(mimeType),
    name: asset.fileName ?? 'avatar.jpg',
    sizeBytes: asset.fileSize ?? bytes.byteLength,
    uri: asset.uri,
  };
}

/** Storage path for a fresh payment-evidence upload. */
export function evidencePathFor(
  userId: string,
  orderId: string,
  extension: string,
  originalName?: string,
): string {
  const suffix = originalName ? `_${safePathStem(originalName)}` : '';
  return `evidence/${userId}/${orderId}_${Date.now()}${suffix}.${extension}`;
}

/**
 * Best-effort recovery of the uploader's original filename from a Storage
 * path: drops the generated `<timestamp>` (QR) or `<orderId>_<timestamp>`
 * (evidence) prefix segments. Older objects without an embedded name, or
 * anything unparseable, fall back to the raw basename.
 */
export function displayFileName(path: string): string {
  const base = path.split('/').pop() ?? path;
  const stem = base.includes('.') ? base.split('.').slice(0, -1).join('.') : base;
  const parts = stem.split('_').filter((part) => part.length > 0);
  let rest: string[];
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) === false && /^\d+$/.test(parts[1])) {
    rest = parts.slice(2); // evidence: <orderId>_<timestamp>_<name>
  } else if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
    rest = parts.slice(1); // qr: <timestamp>_<name>
  } else {
    return base;
  }
  return rest.length > 0 ? `${rest.join('_')}.${base.split('.').pop()}` : base;
}

/** Human-readable file size, e.g. `2.4 MB`. */
export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeTypeForExtension(extension: string): string {
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
}

/** Minimal DOM typing for the web download anchor (no DOM lib in scope). */
interface WebDownloadAnchor {
  href: string;
  download: string;
  target: string;
  rel: string;
  click(): void;
}

interface WebDownloadDocument {
  createElement(tagName: 'a'): WebDownloadAnchor;
  body: { appendChild(node: WebDownloadAnchor): void; removeChild(node: WebDownloadAnchor): void };
}

function getWebDocument(): WebDownloadDocument | null {
  const scope = globalThis as unknown as { document?: WebDownloadDocument };
  return scope.document ?? null;
}

/** Where a download ended up, so the UI can message it accurately. */
export type DownloadOutcome = 'shared' | 'opened';

/**
 * Downloads a private Storage object onto the viewer's device — never just
 * a link, and never through an external browser on native.
 *
 * Flow: fresh short-lived signed URL (created per tap, never stored or
 * logged; existing Storage RLS + signed-URL rules apply unchanged) →
 * native: save into the app cache under the display name (original
 * filename + correct extension via `displayFileName`) with progress
 * reports, then open the system share sheet where the user picks Save to
 * Files / share anywhere → web: direct file download via an anchor with
 * the `download` filename.
 *
 * Requires a dev-client build that includes the `expo-file-system` +
 * `expo-sharing` native modules (installed as SDK 57 deps + config
 * plugin). When sharing is unavailable, falls back to opening the signed
 * URL in the viewer instead of failing.
 */
export async function downloadStorageFile(
  path: string,
  onProgress?: (fraction: number) => void,
): Promise<DownloadOutcome> {
  const url = await signedImageUrl(path);
  const fileName = displayFileName(path);
  if (Platform.OS === 'web') {
    const webDoc = getWebDocument();
    if (webDoc) {
      const anchor = webDoc.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      webDoc.body.appendChild(anchor);
      anchor.click();
      webDoc.body.removeChild(anchor);
      return 'shared';
    }
    await Linking.openURL(url);
    return 'opened';
  }
  const safeName = fileName.replace(/[\\/]/g, '-').slice(0, 120) || 'receipt';
  const destination = new DeviceFile(Paths.cache, safeName);
  if (destination.exists) destination.delete();
  const extension = safeName.split('.').pop()?.toLowerCase() ?? '';
  const task = DeviceFile.createDownloadTask(url, destination, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });
  const output = await task.downloadAsync();
  if (!output) throw new Error('The download was interrupted. Try again.');
  if (!(await Sharing.isAvailableAsync())) {
    await Linking.openURL(url);
    return 'opened';
  }
  await Sharing.shareAsync(output.uri, {
    dialogTitle: fileName,
    mimeType: mimeTypeForExtension(extension),
  });
  return 'shared';
}

/** Uploads a new object. Never overwrites — use a fresh path per upload. */
export async function uploadObject(path: string, file: Uploadable): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .upload(path, file.bytes, { contentType: file.mimeType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

/** Removes an object. Throws when the removal is rejected. */
export async function removeObject(path: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.storage.from(PAYMENT_BUCKET).remove([path]);
  if (error) throw new Error(`Could not remove the old image: ${error.message}`);
}

/**
 * Short-lived signed URL for rendering a private image.
 *
 * Results are cached in memory for 4 minutes (under the 5-minute server
 * TTL) and simultaneous requests for the same path share one call — list
 * remounts, tab switches, and focus refetches no longer pay per render.
 * Failures are never cached.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_CACHE_TTL_MS = 4 * 60 * 1000;

export async function signedImageUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  return dedupeRequest(`send2u:signed-url:${path}`, async () => {
    const supabase = requireClient();
    const { data, error } = await supabase.storage
      .from(PAYMENT_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) throw new Error('Could not open the image. Try again.');
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS });
    return data.signedUrl;
  });
}
