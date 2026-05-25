import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a video file to Firebase Cloud Storage under the /videos/ path
 * Tracks progress through onProgress callback
 */
export async function uploadVideoToFirebase(
  file: File, 
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Build unique file name: videos/[timestamp]_[sanitized_filename]
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `videos/${Date.now()}_${sanitizedName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Calculate exact upload progress percentage
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(progress);
        },
        (error) => {
          console.warn('Firebase Storage upload failed, trigger high-fidelity simulator fallback:', error);
          reject(error);
        },
        async () => {
          // Upload complete, retrieve download URL
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (err) {
            reject(err);
          }
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * High-fidelity Cloud Function Emulation flow representing the backend AI audio extraction, 
 * Gemini processing pipeline, speech-to-subtitle sync, and voice synthesis orchestration.
 */
export interface AIColdFunctionResponse {
  caption: string;
  aiTranscript: string;
  aiTags: string[];
  thumbnailUrl: string;
  description: string;
  voiceUrl: string; // The generated TTS voice URL or base64 data
  status: 'orchestrated';
  timestamp: string;
}

export async function invokeAICloudFunctionProcessor(params: {
  title: string;
  address: string;
  price: number;
  propertyType: string;
  videoUrl: string;
}): Promise<AIColdFunctionResponse> {
  const response = await fetch('/api/ai-video-process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Đường truyền máy chủ AI bận hoặc thời gian kết nối quá hạn (Timeout).');
  }

  const data = await response.json();
  return {
    caption: data.caption,
    aiTranscript: data.aiTranscript,
    aiTags: data.aiTags || [],
    thumbnailUrl: data.thumbnailUrl,
    description: data.description,
    voiceUrl: data.voiceUrl || '',
    status: 'orchestrated',
    timestamp: new Date().toISOString()
  };
}
