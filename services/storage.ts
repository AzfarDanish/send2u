import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { getSupabaseClient } from '@/lib/supabase';

/**
 * Private file storage (`send2u-private` bucket).
 *
 * Conventions: helper QR lives at `qr/<uid>/<timestamp>.<ext>`, payment
 * evidence at `evidence/<uid>/<orderId>_<timestamp>.<ext>`. Unique paths
 * per upload — replacement means uploading a new object and (best-effort)
 * removing the old one, never `upsert`. Only Storage paths/references are
 * stored in the database; file bytes never touch a table.
 */

export const PAYMENT_BUCKET = 'send2u-private';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export interface PickedImage {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
}

/** A payment receipt file: PDF or a common receipt image. */
export interface PickedReceipt {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  fileName: string;
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
  return { bytes, mimeType, extension: extensionFor(mimeType) };
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
  };
}

/** Storage path for a fresh helper QR upload. */
export function qrPathFor(userId: string, extension: string): string {
  return `qr/${userId}/${Date.now()}.${extension}`;
}

/** Storage path for a fresh payment-evidence upload. */
export function evidencePathFor(userId: string, orderId: string, extension: string): string {
  return `evidence/${userId}/${orderId}_${Date.now()}.${extension}`;
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

/** Short-lived signed URL for rendering a private image. */
export async function signedImageUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error('Could not open the image. Try again.');
  return data.signedUrl;
}
