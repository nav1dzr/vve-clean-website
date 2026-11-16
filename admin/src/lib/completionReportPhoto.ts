const MAX_ORIGINAL = 2 * 1024 * 1024;
const MAX_PREVIEW = 300 * 1024;

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read this photograph.'));
    reader.readAsDataURL(blob);
  });
}

export async function prepareCompletionPhoto(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPEG or PNG photograph.');
  if (!file.size || file.size > MAX_ORIGINAL) throw new Error('Choose an original photograph up to 2 MB. The original is preserved unchanged.');
  const originalBase64 = await base64(file);
  const url = `data:${file.type};base64,${originalBase64}`;
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('This photograph could not be decoded.')); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 36_000_000) throw new Error('Choose a photograph no larger than 36 megapixels.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image resizing is unavailable in this browser.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let derivative: Blob | null = null;
    for (const quality of [0.84, 0.7, 0.55, 0.4]) {
      derivative = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (derivative && derivative.size <= MAX_PREVIEW) break;
    }
    if (!derivative || derivative.size > MAX_PREVIEW) throw new Error('The PDF copy is too large. Please choose a smaller photograph.');
    return { filename: file.name, mimeType: file.type, dataBase64: originalBase64, derivativeMimeType: 'image/jpeg', derivativeBase64: await base64(derivative) };
  } finally { /* Data URLs are not registered with the browser object URL store. */ }
}
