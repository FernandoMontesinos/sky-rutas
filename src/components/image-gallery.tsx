import { FileText } from "lucide-react";

function esPdf(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

function PdfCard({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-700 transition hover:border-brand/40 hover:text-brand"
    >
      <FileText className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.75} />
      {label}
    </a>
  );
}

/** Cuadrícula simple de imágenes/PDFs con enlace a tamaño completo en pestaña nueva. */
export function ImageGallery({ urls, alt }: { urls: string[]; alt: string }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return esPdf(urls[0]) ? (
      <PdfCard url={urls[0]} label={`Ver ${alt} (PDF)`} />
    ) : (
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
      {urls.map((url, i) =>
        esPdf(url) ? (
          <PdfCard key={url} url={url} label={`${alt} ${i + 1} (PDF)`} />
        ) : (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${alt} ${i + 1}`}
              className="h-32 w-full rounded-xl border border-gray-200 bg-white object-cover"
            />
          </a>
        )
      )}
    </div>
  );
}
