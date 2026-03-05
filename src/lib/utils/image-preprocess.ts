/**
 * Client-side image preprocessing for OCR.
 * Improves tesseract.js accuracy with grayscale + contrast + threshold.
 */

export async function preprocessImageForOcr(
  imageUrl: string,
  options?: { grayscale?: boolean; contrast?: number; threshold?: number }
): Promise<string> {
  const { grayscale = true, contrast = 1.2, threshold = 128 } = options ?? {};

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i]!;
        let g = data[i + 1]!;
        let b = data[i + 2]!;

        if (grayscale) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = g = b = gray;
        }

        // Contrast
        r = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
        g = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
        b = Math.min(255, Math.max(0, (b - 128) * contrast + 128));

        // Threshold (binarize)
        const avg = (r + g + b) / 3;
        const val = avg > threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}
