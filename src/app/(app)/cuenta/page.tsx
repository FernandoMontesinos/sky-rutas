import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";
import CambiarPasswordForm from "./form";

export default async function CuentaPage() {
  const { profile } = await requireUser();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi cuenta</h1>
        <p className="text-gray-500">
          {profile.full_name} · {ROLE_LABEL[profile.role]}
        </p>
      </div>
      <CambiarPasswordForm />
    </div>
  );
}
