import type { OrderStatus, OrderType, OrderWithNames, Profile } from "@/lib/types";

/**
 * Orden visual del tablero, en un solo lugar.
 *
 * Lo usan la pantalla de Órdenes (para pintar las columnas) y la ficha de una
 * orden (para los botones Anterior/Siguiente). Antes la navegación iba por
 * fecha de subida y no coincidía con lo que se ve en el tablero: pulsar
 * "Siguiente" saltaba a una orden que estaba en otra columna. Si cada lado
 * armara su propio criterio, volverían a desincronizarse.
 */

/**
 * El tablero de "Asignadas" muestra una columna por cada repartidor de esta
 * lista. El match es por el inicio del nombre, sin distinguir mayúsculas ni
 * tildes. Para mostrarlos a todos automáticamente, dejar la lista vacía: `[]`.
 */
export const REPARTIDORES_TABLERO = ["carlos", "albert", "daniel"];

export function repartidorVisible(nombre: string | undefined): boolean {
  if (REPARTIDORES_TABLERO.length === 0) return true;
  const n = (nombre ?? "").toLowerCase();
  return REPARTIDORES_TABLERO.some((r) => n.startsWith(r));
}

/** Alfabético por empresa; las que no tienen nombre van al final, no al principio. */
export function porEmpresa(a: OrderWithNames, b: OrderWithNames): number {
  const na = (a.cliente ?? "").trim();
  const nb = (b.cliente ?? "").trim();
  if (!na && nb) return 1;
  if (na && !nb) return -1;
  return na.localeCompare(nb, "es", { sensitivity: "base" });
}

/**
 * Orden de las tarjetas dentro de una columna: alfabético por empresa y, en
 * Pendientes, con las que volvieron por un intento fallido agrupadas arriba
 * (necesitan otra acción: llamar al proveedor en vez de asignar repartidor).
 */
export function ordenarColumna(
  orders: OrderWithNames[],
  separarNoRecogidos = false
): OrderWithNames[] {
  const ordenadas = [...orders].sort(porEmpresa);
  if (!separarNoRecogidos) return ordenadas;
  return [
    ...ordenadas.filter((o) => o.no_recogido_intentos > 0),
    ...ordenadas.filter((o) => o.no_recogido_intentos === 0),
  ];
}

/** Repartidores que tienen columna propia, en el mismo orden que el tablero. */
export function columnasDeRepartidor(repartidores: Profile[]): Profile[] {
  return repartidores
    .filter((r) => repartidorVisible(r.full_name))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" }));
}

/**
 * Todas las órdenes en el MISMO orden en que se leen en pantalla: sección de
 * Pedidos (Proveedor) primero y luego Cotizaciones (Cliente); dentro de cada
 * una, columna por columna de izquierda a derecha; y dentro de cada columna,
 * el orden de las tarjetas.
 */
export function secuenciaTablero(
  orders: OrderWithNames[],
  repartidores: Profile[]
): OrderWithNames[] {
  const de = (tipo: OrderType, estado: OrderStatus) =>
    orders.filter((o) => o.tipo === tipo && o.estado === estado);

  const columnasRep = columnasDeRepartidor(repartidores);

  /** Las asignadas, agrupadas por repartidor igual que ColumnasAsignadas. */
  const asignadas = (tipo: OrderType): OrderWithNames[] => {
    const todas = de(tipo, "asignado");
    // Sin columnas por repartidor se cae a una sola columna con todas.
    if (columnasRep.length === 0) return ordenarColumna(todas);
    return columnasRep.flatMap((r) =>
      ordenarColumna(todas.filter((o) => o.assigned_to === r.id))
    );
  };

  const seccion = (tipo: OrderType): OrderWithNames[] => [
    ...ordenarColumna(de(tipo, "pendiente"), true),
    ...asignadas(tipo),
    ...ordenarColumna(de(tipo, "en_transito")),
    ...ordenarColumna(de(tipo, "completado")),
  ];

  // Pedidos arriba porque hay más recojos que entregas (pedido de almacén).
  return [...seccion("recojo"), ...seccion("entrega")];
}

/**
 * Orden de la vista propia del repartidor: sus tres pestañas en el mismo
 * orden que la barra inferior (Por hacer / Recogidas / Listas).
 */
export function secuenciaRepartidor(orders: OrderWithNames[]): OrderWithNames[] {
  const de = (estado: OrderStatus) => orders.filter((o) => o.estado === estado);
  return [
    ...ordenarColumna(de("asignado")),
    ...ordenarColumna(de("en_transito")),
    ...ordenarColumna(de("completado")),
  ];
}
