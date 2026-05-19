import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  uploadBytes
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { MediaAsset, MediaType } from '../types/media';

class MediaService {
  private collectionName = 'mediaAssets';

  /**
   * Determine MediaType from MIME type
   */
  private getMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('application/pdf')) return 'document';
    return 'other';
  }

  /**
   * Upload file and create asset record
   */
  async uploadMedia(
    file: File, 
    uploadedBy: string, 
    onProgress?: (progress: number) => void
  ): Promise<MediaAsset> {
    const type = this.getMediaType(file.type);
    const timestamp = Date.now();
    const storagePath = `media/${type}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            
            let metadata: MediaAsset['metadata'] = {
              title: file.name.replace(/\.[^/.]+$/, ""),
            };

            // Attempt to parse metadata for audio
            if (type === 'audio') {
              try {
                const { parseBlob } = await import('music-metadata');
                const meta = await parseBlob(file);
                if (meta.common.title) metadata.title = meta.common.title;
                if (meta.common.artist) metadata.artist = meta.common.artist;
                if (meta.format.duration) metadata.duration = Math.round(meta.format.duration);
                if (meta.common.album) metadata.category = meta.common.album;
              } catch (err) {
                console.warn('Metadata parsing failed:', err);
              }
            }

            const assetData: Omit<MediaAsset, 'id'> = {
              filename: file.name,
              originalName: file.name,
              url,
              storagePath,
              mimeType: file.type,
              size: file.size,
              type,
              uploadedAt: serverTimestamp() as any,
              uploadedBy,
              metadata
            };

            const docRef = await addDoc(collection(db, this.collectionName), assetData);
            resolve({ id: docRef.id, ...assetData } as MediaAsset);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Subscribe to media assets
   */
  subscribeToMedia(type?: MediaType, callback: (assets: MediaAsset[]) => void) {
    let q = query(collection(db, this.collectionName), orderBy('uploadedAt', 'desc'));
    
    if (type) {
      q = query(collection(db, this.collectionName), where('type', '==', type), orderBy('uploadedAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      const assets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaAsset[];
      callback(assets);
    });
  }

  /**
   * Delete media asset (Firestore + Storage)
   */
  async deleteMedia(asset: MediaAsset) {
    try {
      // 1. Delete from Storage
      const storageRef = ref(storage, asset.storagePath);
      await deleteObject(storageRef).catch(err => {
        console.warn('File not found in storage, proceeding with Firestore deletion', err);
      });

      // 2. Delete from Firestore
      await deleteDoc(doc(db, this.collectionName, asset.id));
    } catch (error) {
      console.error('Error deleting media asset:', error);
      throw error;
    }
  }

  /**
   * Update asset metadata
   */
  async updateMetadata(assetId: string, metadata: Partial<MediaAsset['metadata']>) {
    const docRef = doc(db, this.collectionName, assetId);
    await updateDoc(docRef, { metadata });
  }

  /**
   * Get all media assets once
   */
  async getAllMedia(type?: MediaType): Promise<MediaAsset[]> {
    let q = query(collection(db, this.collectionName), orderBy('uploadedAt', 'desc'));
    if (type) {
      q = query(collection(db, this.collectionName), where('type', '==', type), orderBy('uploadedAt', 'desc'));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MediaAsset[];
  }
}

export const mediaService = new MediaService();
