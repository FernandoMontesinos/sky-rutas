/**
 * URL que fuerza la descarga de un archivo de Supabase Storage.
 *
 * El atributo `download` de <a> solo funciona en archivos del MISMO origen;
 * las fotos viven en el dominio de Supabase, así que el navegador lo ignoraba
 * y se limitaba a abrir la imagen en otra pestaña, sin descargar nada.
 *
 * Storage acepta `?download=<nombre>`, que hace que el servidor responda con
 * `Content-Disposition: attachment` — ahí sí el navegador descarga, y además
 * con el nombre que le demos en vez del identificador aleatorio del archivo.
 */
export function urlDescarga(url: string, nombre?: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return nombre
    ? `${url}${sep}download=${encodeURIComponent(nombre)}`
    : `${url}${sep}download`;
}

/** Extensión real del archivo (jpg/png/pdf...), para no bautizarlo mal. */
export function extensionDe(url: string): string {
  const limpia = url.split("?")[0];
  const punto = limpia.lastIndexOf(".");
  if (punto === -1) return "jpg";
  const ext = limpia.slice(punto + 1).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
}

/**
 * Nombre con el que se guarda el archivo: prefijo legible + posición cuando
 * hay varios. Ej. "guia-S15341-2.jpg" en vez de "1756042-0.jpg".
 */
export function nombreArchivo(
  prefijo: string,
  url: string,
  indice?: number,
  total?: number
): string {
  const base = prefijo.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  const sufijo = total && total > 1 && indice !== undefined ? `-${indice + 1}` : "";
  return `${base}${sufijo}.${extensionDe(url)}`;
}
