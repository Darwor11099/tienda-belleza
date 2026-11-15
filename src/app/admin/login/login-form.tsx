"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/admin/actions";

const field = "mt-1.5 h-12 w-full rounded-2xl border border-input bg-card px-4 text-base focus:border-primary focus:outline-none";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: initialError });
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="text-sm font-medium">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={field} />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button disabled={pending} className="h-12 w-full rounded-full bg-primary font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
