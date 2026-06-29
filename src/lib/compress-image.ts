/**
 * Comprime una imagen en el navegador antes de subirla:
 * la redimensiona (lado máximo `maxDim`) y la reexporta como JPEG.
 * Reduce fotos de celular de varios MB a ~200–400 KB sin perder legibilidad.
 * Si algo falla, devuelve el archivo original.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.7
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image", // respeta la rotación EXIF de la cámara
    });

    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    // Si por algún motivo el JPEG quedó más grande, usa el original.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
