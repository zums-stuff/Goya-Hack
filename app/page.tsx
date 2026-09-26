// app/page.tsx — Wallapop/MercadoLibre style: yellow market band + listing grid.
//
// Esta pantalla comunica "ESTO ES UN MERCADO" antes que cualquier otra cosa:
// amarillo de marca, productos reales del seed visibles, CTA grande, copy
// directo de venta (no poético). El login de seed users está integrado como
// una sección dentro del flujo de entrada.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { seedUsers, seedListings } from '@/lib/seed-data';
import { DemoLoginPanel, type SeedUserRow } from '@/components/auth/DemoLoginPanel';
import { ListingCard } from '@/components/marketplace/ListingCard';

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  const devLogin = isDevLoginAvailable();
  const pollar = computePollarSetupStatus(process.env);

  const seedRows: SeedUserRow[] = devLogin
    ? seedUsers
        .map((u) => ({
          email: u.email,
          displayName: u.displayName,
          major: u.major,
          balanceXlm: u.balanceXlm,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
    : [];

  const sellersById = Object.fromEntries(
    seedUsers.map((u) => [u.id, u.displayName]),
  );

  const listings = seedListings.slice(0, 8);

  return (
    <main className="min-h-screen bg-white text-black">
      {/* ── Header amarillo MercadoLibre-style ─────────────── */}
      <header className="bg-[#FFE600]">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3.5">
          <Link href="/" className="flex-none">
            <span className="text-[26px] font-black leading-none tracking-tight">
              PumaTrade
            </span>
          </Link>
          <div className="hidden flex-1 md:block">
            <div className="flex items-center gap-2 rounded bg-white px-3 py-2 shadow-sm">
              <span className="text-sm text-black/40">🔍</span>
              <span className="text-sm text-black/45">
                Buscar calculadoras, libros, electrónica…
              </span>
            </div>
          </div>
          <nav className="flex-none">
            <Link
              href="/setup"
              className="text-sm font-medium text-black/70 hover:text-black"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Stats strip negra con números reales ───────────── */}
      <div className="bg-black text-[#FFE600]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-1.5 font-mono text-[11px]">
          <span>
            <strong>5</strong> estudiantes
          </span>
          <span className="text-[#FFE600]/50">·</span>
          <span>
            <strong>10</strong> productos publicados
          </span>
          <span className="text-[#FFE600]/50">·</span>
          <span>
            <strong>4</strong> trueques activos
          </span>
          <span className="text-[#FFE600]/50">·</span>
          <span>Stellar testnet</span>
          <span className="ml-auto hidden text-[#FFE600]/70 sm:inline">
            Goya-Hack · 2026
          </span>
        </div>
      </div>

      {/* ── Hero — copy directo de venta ───────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pt-8 pb-6 sm:pt-12 sm:pb-8">
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          Vende lo que ya no usas.{' '}
          <span className="block">Truequea con tu comunidad.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/70 sm:text-base">
          Marketplace P2P entre estudiantes de la UNAM. Tu dinero queda en
          escrow Stellar hasta que recibas el artículo.
        </p>
      </section>

      {/* ── Login principal ───────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-10">
        {devLogin && <DemoLoginPanel users={seedRows} />}

        {!devLogin && pollar.needsSetup && (
          <div className="border-y-2 border-black bg-[#FAFAFA] p-6 text-center">
            <p className="text-sm text-black/70">
              Para entrar con tu cuenta, completa{' '}
              <Link
                href="/setup"
                className="font-semibold underline decoration-2 underline-offset-2"
              >
                la configuración de Pollar
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      {/* ── Grid de productos (PRUEBA VIVA de marketplace) ── */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold sm:text-xl">Productos publicados</h2>
          <span className="text-xs text-black/55">
            Sembrados para el demo · clic para ver
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {listings.map((l) => (
            <li key={l.id}>
              <ListingCard
                listing={l}
                sellerName={sellersById[l.sellerId] ?? '—'}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-black/10 bg-[#FAFAFA]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-black/55">
          <span>PumaTrade · marketplace P2P entre estudiantes UNAM.</span>
          <span className="font-mono">Goya-Hack · 2026 · Stellar testnet</span>
        </div>
      </footer>
    </main>
  );
}