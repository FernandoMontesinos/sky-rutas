import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODALIDAD_SHORT, TYPE_LABEL, type Modalidad, type OrderType } from "@/lib/types";

type Row = {
  cliente: string | null;
  numero_pedido: string;
  tipo: OrderType;
  modalidad: Modalidad;
  entrega_parcial: boolean;
  completed_at: string | null;
  repartidor: { full_name: string } | null;
};

function esc(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function limaDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayLima() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  // Autorización: solo almacén/admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "almacen"].includes(profile.role as string)) {
    return new NextResponse("Sin permiso", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const hasta = sp.get("hasta") || todayLima();
  const defDesde = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });
  const desde = sp.get("desde") || defDesde;

  // Límites del día en hora de Lima (UTC-5).
  const desdeISO = `${desde}T00:00:00-05:00`;
  const hastaISO = `${hasta}T23:59:59-05:00`;

  const { data } = await supabase
    .from("orders")
    .select(
      "cliente, numero_pedido, tipo, modalidad, entrega_parcial, completed_at, repartidor:profiles!orders_assigned_to_fkey(full_name)"
    )
    .eq("estado", "completado")
    .gte("completed_at", desdeISO)
    .lte("completed_at", hastaISO)
    .order("completed_at", { ascending: true });

  const rows = (data ?? []) as unknown as Row[];

  const header = [
    "Cliente / Proveedor",
    "N° de orden / pedido",
    "Tipo",
    "Modalidad",
    "Estado de entrega",
    "Repartidor",
    "Fecha y hora (completado/recogido)",
  ];

  const body = rows
    .map(
      (r) => `<tr>
        <td>${esc(r.cliente ?? "")}</td>
        <td>${esc(r.numero_pedido)}</td>
        <td>${esc(TYPE_LABEL[r.tipo])}</td>
        <td>${esc(MODALIDAD_SHORT[r.modalidad])}</td>
        <td>${esc(r.entrega_parcial ? "Parcial" : "Completo")}</td>
        <td>${esc(r.repartidor?.full_name ?? "")}</td>
        <td>${esc(limaDateTime(r.completed_at))}</td>
      </tr>`
    )
    .join("");

  const html = `<html><head><meta charset="utf-8"></head><body>
    <table border="1">
      <thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body></html>`;

  return new NextResponse("﻿" + html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="skyhigh-ordenes_${desde}_a_${hasta}.xls"`,
    },
  });
}
