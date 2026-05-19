import { Timestamp } from 'firebase/firestore';

export type MediaType = 'audio' | 'image' | 'video' | 'document' | 'other';

export interface MediaAsset {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  storagePath: string;
  mimeType: string;
  size: number;
  type: MediaType;
  uploadedAt: Timestamp | Date;
  uploadedBy: string; // codename or uid
  metadata: {
    title?: string;
    description?: string;
    artist?: string;      // Artist/Creator
    duration?: number; // for audio/video
    width?: number;    // for images
    height?: number;   // for images
    category?: string;
    tags?: string[];
  };
}
