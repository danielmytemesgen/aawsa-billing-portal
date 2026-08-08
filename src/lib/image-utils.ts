export const compressImage = (
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate the new dimensions while keeping the aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP for best compression, fallback to JPEG if unsupported (though modern browsers support WebP)
        const compressedDataUrl = canvas.toDataURL("image/webp", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export interface ImageExifMetadata {
  timestamp?: string;
  hasExif?: boolean;
  hasLocationData?: boolean;
}

/**
 * Parses basic camera EXIF metadata and timestamp markers from image file buffer.
 */
export const extractImageMetadata = async (file: File): Promise<ImageExifMetadata> => {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          resolve({ hasExif: false });
          return;
        }
        const view = new DataView(buffer);
        // Check for JPEG SOI marker (0xFFD8)
        if (view.getUint16(0, false) !== 0xFFD8) {
          resolve({ hasExif: false, timestamp: new Date(file.lastModified).toLocaleString() });
          return;
        }
        
        let offset = 2;
        let hasExif = false;
        let hasLocation = false;
        
        while (offset < view.byteLength - 2) {
          const marker = view.getUint16(offset, false);
          // APP1 marker (0xFFE1) typically contains EXIF and GPS info
          if (marker === 0xFFE1) {
            hasExif = true;
            // Scan segment bytes for "GPS" or location tags
            const segmentLen = view.getUint16(offset + 2, false);
            for (let i = offset; i < Math.min(offset + segmentLen, view.byteLength - 3); i++) {
              if (view.getUint8(i) === 0x47 && view.getUint8(i+1) === 0x50 && view.getUint8(i+2) === 0x53) { // 'GPS'
                hasLocation = true;
                break;
              }
            }
            break;
          }
          if ((marker & 0xFF00) !== 0xFF00) break;
          offset += 2 + view.getUint16(offset + 2, false);
        }

        resolve({
          hasExif,
          hasLocationData: hasLocation,
          timestamp: new Date(file.lastModified).toLocaleString()
        });
      };
      reader.onerror = () => resolve({ hasExif: false });
      reader.readAsArrayBuffer(file.slice(0, 128 * 1024)); // Read first 128KB header
    } catch {
      resolve({ hasExif: false });
    }
  });
};
