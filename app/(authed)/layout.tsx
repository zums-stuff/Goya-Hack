// app/(authed)/layout.tsx — Layout compartido para todas las páginas autenticadas.
//
// El route group (authed) no aparece en la URL: app/(authed)/home/page.tsx
// sigue siendo /home. Aquí centralizamos:
//   1. La resolución de sesión (un solo tryGetUser + redirect si no hay).
//   2. El shell visual (sidebar + topbar) para que las páginas hijas trabajen
//      directamente sobre <main className="content-wrap">.
//   3. La actividad del item actual del sidebar (usePathname) ya la maneja
//      AppShell internamente.

import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { AppShell } from '@/components/dashboard/AppShell';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const me = await tryGetUser();
  if (!me) redirect('/');

  return (
    <AppShell me={{ id: me.id, displayName: me.displayName, balanceXlm: me.balanceXlm }}>
      {children}
    </AppShell>
  );
}
