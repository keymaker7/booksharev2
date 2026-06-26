export function compressCover(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 480;
      let w = img.width;
      let h = img.height;
      if (w > max || h > max) {
        if (w > h) {
          h = Math.round((h * max) / w);
          w = max;
        } else {
          w = Math.round((w * max) / h);
          h = max;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      let quality = 0.82;
      const tryExport = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('사진을 처리할 수 없어요'));
              return;
            }
            if (blob.size > 400000 && quality > 0.35) {
              quality -= 0.07;
              tryExport();
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      };
      tryExport();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 불러올 수 없어요'));
    };
    img.src = url;
  });
}

export function getStoredName() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('bookshare_name') || '';
}

export function saveName(name: string) {
  if (name) localStorage.setItem('bookshare_name', name);
}
