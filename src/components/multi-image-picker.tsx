"use client";

import { useEffect, useRef } from "react";
import { Camera, ImagePlus, ClipboardPaste, X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

export type PickedImage = { file: File; preview: string };

/**
 * Selector de una o varias imágenes, con miniaturas y opción de quitar
 * cada una. En celular ofrece botones directos de cámara/galería; en PC
 * además admite pegar con Ctrl+V. Cada imagen se comprime antes de
 * agregarse a la lista (ver lib/compress-image.ts).
 */
export function MultiImagePicker({
  label,
  images,
  onChange,
  allowPaste = false,
}: {
  label: string;
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
  allowPaste?: boolean;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const nuevas: PickedImage[] = [];
    for (const f of Array.from(fileList)) {
      if (!f.type.startsWith("image/")) continue;
      const compressed = await compressImage(f);
      nuevas.push({ file: compressed, preview: URL.createObjectURL(compressed) });
    }
    if (nuevas.length > 0) onChange([...images, ...nuevas]);
  }

  function removeAt(i: number) {
    onChange(images.filter((_, idx) => idx !== i));
  }

  useEffect(() => {
    if (!allowPaste) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        addFiles(dt.files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // Se vuelve a suscribir cada vez que cambian las imágenes para que
    // addFiles siempre agregue sobre la lista más reciente (evita perder
    // imágenes ya agregadas si se pega más de una vez).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowPaste, images]);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>

      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt=""
                className="h-20 w-full rounded-lg border border-gray-200 bg-white object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Quitar imagen"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition-transform hover:scale-110"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Celular: cámara o galería */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-white px-3 py-5 text-center text-gray-600 transition active:scale-95 active:border-brand active:text-brand"
        >
          <Camera className="h-7 w-7" strokeWidth={1.75} />
          <span className="text-sm font-semibold">Tomar foto</span>
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-white px-3 py-5 text-center text-gray-600 transition active:scale-95 active:border-brand active:text-brand"
        >
          <ImagePlus className="h-7 w-7" strokeWidth={1.75} />
          <span className="text-sm font-semibold">
            {images.length > 0 ? "Agregar otra" : "Elegir imagen"}
          </span>
        </button>
      </div>

      {/* PC/tablet: pegar o elegir */}
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="hidden w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-6 text-center text-gray-500 transition hover:border-brand hover:text-brand sm:flex"
      >
        <ClipboardPaste className="h-7 w-7" strokeWidth={1.75} />
        <span className="font-medium">
          {allowPaste ? "Pega una imagen aquí (Ctrl + V)" : "Toca para elegir imagen"}
        </span>
        <span className="text-sm">
          {images.length > 0 ? "o haz clic para agregar otra" : "o haz clic para elegir un archivo"}
        </span>
      </button>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
