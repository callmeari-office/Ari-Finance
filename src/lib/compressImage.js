export function compressImage(file, { maxWidth = 600, maxHeight = 600, quality = 0.6 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = () => reject(new Error('Không thể đọc ảnh.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Không thể đọc file.'));
    reader.readAsDataURL(file);
  });
}
