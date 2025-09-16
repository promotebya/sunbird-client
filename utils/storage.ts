// utils/storage.ts
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';

/**
 * Upload a local file (expo-image-picker URI) to Firebase Storage and return its downloadURL.
 * @param uri local file URI (e.g., from ImagePicker)
 * @param path storage path like "images/{ownerUid}/memories/{filename}"
 * @param onProgress optional progress callback [0..1]
 */
export async function uploadFileToStorage(
  uri: string,
  path: string,
  onProgress?: (p: number) => void
): Promise<string> {
  const storage = getStorage();
  const storageRef = ref(storage, path);

  // Turn the local file into a Blob
  const res = await fetch(uri);
  const blob = await res.blob();

  const task = uploadBytesResumable(storageRef, blob);
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) {
          const p = snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0;
          onProgress(p);
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/** Generate a simple filename without external deps */
export function generateFilename(ext = 'jpg') {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
}
