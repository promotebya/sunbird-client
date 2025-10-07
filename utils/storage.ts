// utils/storage.ts
import * as FileSystem from 'expo-file-system';
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';

/** Simple unique filename helper */
export function generateFilename(ext = 'jpg') {
  const id = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}_${id}.${ext.replace('.', '')}`;
}

/**
 * Upload a local file URI (file://, content://, assets-library://, ph://) to Firebase Storage.
 * Returns the download URL. Reports progress via onProgress (0..1).
 */
export async function uploadFileToStorage(
  localUri: string,
  storagePath: string,
  onProgress?: (p: number) => void
): Promise<string> {
  if (!localUri) throw new Error('No file to upload.');

  // Normalize to a real file:// path first
  const fileUri = await ensureFileUri(localUri);

  // Convert into Blob for upload
  const res = await fetch(fileUri);
  const blob = await res.blob();

  const storage = getStorage();
  const objectRef = ref(storage, storagePath);

  const task = uploadBytesResumable(objectRef, blob);

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      snap => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(snap.bytesTransferred / snap.totalBytes);
        }
      },
      (err) => {
        const code = (err as any)?.code || 'storage/unknown';
        const msg = (err as any)?.message || 'Upload failed';
        reject(Object.assign(new Error(msg), { code }));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

/* ---------- helpers ---------- */

async function ensureFileUri(input: string): Promise<string> {
  if (input.startsWith('file://')) return input;

  // For content://, assets-library://, ph://, etc., copy/download into cache first
  const ext = guessExt(input) || 'jpg';
  const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}.${ext}`;

  try {
    await FileSystem.copyAsync({ from: input, to: dest });
    return dest;
  } catch {
    const { uri } = await FileSystem.downloadAsync(input, dest);
    return uri;
  }
}

function guessExt(uri: string): string | null {
  const q = uri.split('?')[0];
  const dot = q.lastIndexOf('.');
  if (dot !== -1 && dot < q.length - 1) return q.slice(dot + 1).toLowerCase();
  return null;
}