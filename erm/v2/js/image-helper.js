/**
 * ERM v2 - Image Helper Module
 * Resizes, optimizes, and processes JPG images for timeline records
 */

class ImageHelper {
  /**
   * Process and convert any uploaded image into an optimized JPG Base64 Data URL
   * @param {File} file 
   * @param {number} maxDimension - Max width or height in pixels (default 1280px)
   * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default 0.82)
   * @returns {Promise<string>} JPG Data URL
   */
  static processToJPG(file, maxDimension = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.match(/^image\//i)) {
        reject(new Error('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG/PNG)'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          // Scale down if larger than maxDimension while preserving aspect ratio
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          // Fill background with white in case of transparent PNG conversion
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Always export as clean JPEG format
          const jpgDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(jpgDataUrl);
        };
        img.onerror = () => reject(new Error('ไม่สามารถประมวลผลไฟล์รูปภาพได้'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Trigger direct browser download of a JPG image
   * @param {string} dataUrl 
   * @param {string} filename 
   */
  static downloadJPG(dataUrl, filename = 'incident-photo.jpg') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

window.imageHelper = ImageHelper;
