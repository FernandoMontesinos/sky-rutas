/** Cuadrícula simple de imágenes con enlace a tamaño completo en pestaña nueva. */
export function ImageGallery({ urls, alt }: { urls: string[]; alt: string }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls[0]}
        alt={alt}
        className="w-full rounded-xl border border-gray-200 bg-white object-contain"
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${alt} ${i + 1}`}
            className="h-32 w-full rounded-xl border border-gray-200 bg-white object-cover"
          />
        </a>
      ))}
    </div>
  );
}
