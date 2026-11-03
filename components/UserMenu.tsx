"use client";

import { useSession, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 hidden sm:inline">{session.user.email}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
      >
        Esci
      </button>
    </div>
  );
}
