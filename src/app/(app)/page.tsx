import Link from "next/link";
import { PackagePlus, PackageCheck, Truck, ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/types";

export default async function HomePage() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();

  // Conteos según rol
  const base = () => supabase.from("orders").select("*", { count: "exact", head: true });

  const [pendientes, asignadas, completadasHoy] = await Promise.all([
    base().eq("estado", "pendiente"),
    profile.role === "repartidor"
      ? base().eq("estado", "asignado").eq("assigned_to", userId)
      : base().eq("estado", "asignado"),
    base()
      .eq("estado", "completado")
      .gte("completed_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const cards = [
    {
      label: profile.role === "repartidor" ? "Por hacer" : "Pendientes",
      value: profile.role === "repartidor" ? asignadas.count ?? 0 : pendientes.count ?? 0,
      tone: "bg-gray-100 text-gray-800",
    },
    {
      label: profile.role === "repartidor" ? "Asignadas a ti" : "Asignadas",
      value: asignadas.count ?? 0,
      tone: "bg-amber-50 text-amber-800",
    },
    {
      label: "Completadas hoy",
      value: completadasHoy.count ?? 0,
      tone: "bg-green-50 text-green-800",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          Hola, {profile.full_name.split(" ")[0]}
          <span className="inline-block origin-[70%_70%] animate-[wave_1.8s_ease-in-out_1]">
            👋
          </span>
        </h1>
        <p className="text-gray-500">{ROLE_LABEL[profile.role]}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl p-4 ${c.tone}`}>
            <div className="text-3xl font-black">{c.value}</div>
            <div className="text-xs font-medium opacity-80">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {(profile.role === "admin" || profile.role === "vendedor") && (
          <Link
            href="/ordenes/nueva"
            className="flex items-start gap-3 rounded-2xl bg-brand p-5 font-semibold text-white shadow transition hover:bg-brand-dark hover:shadow-md"
          >
            <PackagePlus className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2} />
            <span>
              Subir nueva orden
              <span className="mt-1 block text-sm font-normal opacity-90">
                Pega la imagen de la orden y registra entrega o recojo
              </span>
            </span>
          </Link>
        )}

        {(profile.role === "admin" || profile.role === "almacen") && (
          <Link
            href="/ordenes?estado=pendiente"
            className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 hover:shadow"
          >
            <PackageCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand" strokeWidth={2} />
            <span>
              Asignar órdenes a repartidores
              <span className="mt-1 block text-sm font-normal text-gray-500">
                {pendientes.count ?? 0} pendiente(s) por asignar
              </span>
            </span>
          </Link>
        )}

        {profile.role === "repartidor" && (
          <Link
            href="/ordenes"
            className="flex items-start gap-3 rounded-2xl bg-brand p-5 font-semibold text-white shadow transition hover:bg-brand-dark hover:shadow-md"
          >
            <Truck className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2} />
            <span>
              Ver mi ruta del día
              <span className="mt-1 block text-sm font-normal opacity-90">
                Entra a cada orden y toma la foto de la guía
              </span>
            </span>
          </Link>
        )}

        <Link
          href="/ordenes"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 hover:shadow"
        >
          <ClipboardList className="h-6 w-6 shrink-0 text-brand" strokeWidth={2} />
          Ver todas las órdenes
        </Link>
      </div>
    </div>
  );
}
