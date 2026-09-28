// components/auth/PollarLoginActions.tsx -- Gremium-branded Pollar auth
// trigger. Single-panel UX: the Pollar demo-aesthetic card on / IS the
// auth surface. It transitions in place through the auth steps
// (choice | code | busy | error | authed) without opening a second
// modal.
//
// Provider surface (post SDK audit, see git log for 9570cf9 -> here):
//   The Pollar SDK @pollar/react ships with these explicit providers:
//     'email'  - sendEmailCode + verifyEmailCode
//     'google' - OAuth via window.open popup
//     'github' - OAuth via window.open popup
//   Source: node_modules/@pollar/core/dist/index.d.ts
//           type PollarAuthMethod = 'email' | 'google' | 'github' | 'oidc';
//           for...of = oauthProvider("google"), oauthProvider("github"),
//                       emailProvider()  (only registered by constructor)
//           LoginModalTemplateProps.onSocialLogin:
//             (provider: 'google' | 'github') => void
//   Apple, X (Twitter), Discord are *not* wired in this SDK version and
//   would set auth state to "No auth provider registered for 'apple'"
//   if called via login({provider}). They're shown only as a footer
//   hint that additional OAuth providers can be requested through
//   Pollar support.
//
//   Wallet adapters: Freighter and Albedo ship in by default and are
//   reached via getClient().login({ provider: 'freighter-native' })
//   or 'albedo-native'. We surface them dynamically via
//   getClient().listWalletAdapters() so the row stays in sync if
//   Pollar adds more adapters in a future SDK update.

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Mail,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import { usePollar } from '@pollar/react';
import {
  gre_github,
  gre_google,
  gre_pollar_mark,
} from './pollar-svgs';

type OAuthProvider = 'google' | 'github';

type WalletAdapter = {
  id: string;
  name: string;
  iconUrl: string | null;
  group: string | null;
};

type Mode =
  | { kind: 'choice' }
  | { kind: 'code'; email: string }
  | {
      kind: 'busy';
      provider: 'email' | OAuthProvider | 'wallet';
      walletId?: string;
      walletName?: string;
    }
  | {
      kind: 'error';
      message: string;
      backTo: 'choice' | 'code';
      lastEmail: string;
    };

export function PollarLoginActions() {
  const {
    isAuthenticated,
    verified,
    wallet,
    wallets,
    getClient,
    logout,
  } = usePollar();

  const [mode, setMode] = useState<Mode>({ kind: 'choice' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [walletAdapters, setWalletAdapters] = useState<WalletAdapter[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const fired = useRef(false);
  const fallbackTimer = useRef<number | null>(null);

  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  // Discover registered wallet adapters once Pollar is ready. The
  // SDK registers Freighter + Albedo by default; future adapter
  // bundles added via config.walletAdapters will appear here too.
  useEffect(() => {
    let killed = false;
    (async () => {
      try {
        const client = getClient();
        await client.ready?.();
        const list = client.listWalletAdapters?.() ?? [];
        if (killed) return;
        setWalletAdapters(
          list.map((a) => ({
            id: a.id,
            name: a.meta?.label ?? humanizeAdapter(a.id),
            iconUrl: a.meta?.iconUrl ?? null,
            group: a.meta?.group ?? null,
          })),
        );
      } catch {
        // SDK not ready yet; keep empty list
      }
    })();
    return () => {
      killed = true;
    };
  }, [getClient]);

  // Sync lives in this always-mounted component. Fires once on
  // wallet binding, posts to /api/auth/sync, redirects to /home on
  // success. Backup: 2.5s watchdog (see below) + manual retry.
  useEffect(() => {
    if (fired.current) return;
    if (!isAuthenticated || !verified) return;
    if (!stellarAddress || !stellarAddress.startsWith('G')) return;
    fired.current = true;
    void runSync(stellarAddress);
  }, [isAuthenticated, verified, stellarAddress, getClient]);

  // Watchdog. ANTES este timer hacía `window.location.assign('/home')`, lo
  // que era un DEAD END garantizado: si el sync no había corrido, no había
  // cookie, y el layout de (authed) rebotaba a `/`. Ademásaba con el
  // mensaje de "Sesion activa" mientras te expulsaba. Ahora solo marca el
  // fallo para que la tarjeta muestre el error y ofrezca reintentar /
  // Modo demo. La navegación successful la hace `runSync` en su `try`.
  useEffect(() => {
    if (!isAuthenticated || !wallet?.address) return;
    if (fallbackTimer.current !== null) return;
    fallbackTimer.current = window.setTimeout(() => {
      fallbackTimer.current = null;
      if (fired.current) return; // el sync está en curso o ya terminó
      setSyncError(
        'Pollar te autenticó pero no pudimos verificar la wallet. ' +
          'Revisa que Freighter/Albedo estén desbloqueadas, o usa el ' +
          'Modo demo de esta página.',
      );
    }, 2500);
    return () => {
      if (fallbackTimer.current !== null) {
        window.clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };
  }, [isAuthenticated, wallet?.address]);

  async function runSync(address: string) {
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    try {
      const client = getClient();
      let mail: string | undefined;
      let displayName: string;
      try {
        const profile = client.getUserProfile();
        mail = profile?.mail;
        const fn = profile?.first_name?.trim() ?? '';
        const ln = profile?.last_name?.trim() ?? '';
        displayName = [fn, ln].filter(Boolean).join(' ');
        if (!displayName)
          displayName =
            mail?.split('@')[0] ?? `user_${address.slice(0, 6)}`;
      } catch {
        mail = undefined;
        displayName = `user_${address.slice(0, 6)}`;
      }

      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollarWalletId: address,
          email: mail ?? `${address.slice(0, 12)}@stellar.local`,
          displayName,
        }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      window.location.assign('/home');
    } catch (e) {
      // ⚠️ Este catch ANTES era `catch {}` — se comía el error y el
      // fallback timer mandaba a /home sin cookie. El layout de (authed)
      // hace `redirect('/')` cuando no hay sesión, así que el usuario
      // veía la página recargarse en loop y "Ir al dashboard" no
      // llevaba a ninguna parte. Ahora paramos el timer y mostramos el
      // motivo real, que es la diferencia entre un bug y un misterio.
      if (fallbackTimer.current !== null) {
        window.clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
      setSyncError(
        (e as Error).message ||
          'No pudimos iniciar sesión en Gremium con esta cuenta.',
      );
    }
  }

  // === Auth flow control ================================================

  function validateEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  }

  async function startEmail() {
    if (!validateEmail(email)) {
      setError('Escribe un correo valido.');
      return;
    }
    setError(null);
    const trimmed = email.trim();
    setMode({ kind: 'busy', provider: 'email' });
    try {
      await getClient().sendEmailCode(trimmed);
      setMode({ kind: 'code', email: trimmed });
    } catch (e) {
      setMode({
        kind: 'error',
        message: (e as Error).message,
        backTo: 'choice',
        lastEmail: trimmed,
      });
    }
  }

  async function verifyCode() {
    if (mode.kind !== 'code') return;
    if (code.trim().length < 4) {
      setError('Escribe el codigo que te enviamos.');
      return;
    }
    setError(null);
    const lastEmail = mode.email;
    try {
      await getClient().verifyEmailCode(code.trim());
      // success → isAuthenticated flips → useEffect runs runSync → /home
    } catch (e) {
      setMode({
        kind: 'error',
        message: (e as Error).message,
        backTo: 'code',
        lastEmail,
      });
    }
  }

  async function startSocial(provider: OAuthProvider) {
    setError(null);
    setMode({ kind: 'busy', provider });
    try {
      getClient().login({ provider });
    } catch (e) {
      setMode({
        kind: 'error',
        message: (e as Error).message,
        backTo: 'choice',
        lastEmail: email,
      });
    }
  }

  function startWallet(adapterId: string, adapterName: string) {
    setError(null);
    setMode({
      kind: 'busy',
      provider: 'wallet',
      walletId: adapterId,
      walletName: adapterName,
    });
    try {
      getClient().login({ provider: adapterId });
    } catch (e) {
      setMode({
        kind: 'error',
        message: (e as Error).message,
        backTo: 'choice',
        lastEmail: email,
      });
    }
  }

  function cancelBusy() {
    try {
      getClient().cancelLogin();
    } catch {
      /* ignore */
    }
    try {
      logout();
    } catch {
      /* ignore */
    }
    setMode({ kind: 'choice' });
    setError(null);
  }

  // === Already-authenticated: success card ==============================
  if (isAuthenticated && wallet?.address) {
    return (
      <div className="pollar-login-card">
        <div className="pollar-login-brandrow">
          <div
            aria-hidden="true"
            style={{
              width: 38,
              height: 42,
              display: 'inline-grid',
              placeItems: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: gre_pollar_mark }}
          />
          <div className="pollar-login-wordmark">pollar</div>
          <span className="pollar-demo-pill">Gremium</span>
        </div>
        <h2 className="pollar-login-h2">
          {syncError ? 'No pudimos entrar' : 'Sesion activa'}
        </h2>
        {syncError ? (
          <div
            className="pollar-status-sub"
            style={{
              color: 'var(--primary)',
              textAlign: 'left',
              marginTop: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle
              style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }}
            />
            <span>{syncError}</span>
          </div>
        ) : (
          <>
            <div className="form-success-pill" style={{ marginTop: 12 }}>
              <Wallet style={{ width: 14, height: 14 }} />
              <span
                style={{
                  fontFamily:
                    'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                  fontSize: 12,
                }}
              >
                {wallet.address.slice(0, 6)}...
                {wallet.address.slice(-4)}
              </span>
            </div>
            <p className="pollar-status-sub">Recargando al dashboard...</p>
          </>
        )}
        <button
          type="button"
          className="pollar-modal-primary"
          style={{ marginTop: 12 }}
          onClick={() => {
            // Sin sesión server-side, /home rebota a /. Tiene que
            // quedar claro en el botón que esto no es un enlace normal.
            if (syncError) return;
            window.location.assign('/home');
          }}
          disabled={!!syncError}
        >
          {syncError ? 'Sesion incompleta' : 'Ir al dashboard'}
        </button>
        {syncError && (
          <p className="pollar-status-sub" style={{ marginTop: 10 }}>
            Pollar sí te autenticó, pero Gremium no pudo abrir tu sesión.
            Puedes usar el <strong>Modo demo</strong> de esta página para
            entrar sin configuración, o reintentar.
          </p>
        )}
        {syncError && (
          <button
            type="button"
            className="pollar-modal-primary"
            style={{ marginTop: 10 }}
            onClick={() => {
              fired.current = false;
              setSyncError(null);
              if (stellarAddress) void runSync(stellarAddress);
            }}
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          className="gre-pillar-btn-retry"
          style={{ marginTop: 8 }}
          onClick={() => {
            setSyncError(null);
            logout();
          }}
        >
          Cerrar sesion
        </button>
        <SinglePanelStyles />
      </div>
    );
  }

  // === Auth UI: choice | code | busy | error -- all in the SAME card ===

  return (
    <div className="pollar-login-card">
      <div className="pollar-login-brandrow">
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 42,
            display: 'inline-grid',
            placeItems: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: gre_pollar_mark }}
        />
        <div className="pollar-login-wordmark">pollar</div>
        <span className="pollar-demo-pill">Gremium</span>
      </div>

      {/* Step: choice ------------------------------------------------ */}
      {mode.kind === 'choice' && (
        <>
          <h2 className="pollar-login-h2">Iniciar sesion o registrarse</h2>

          <div className="pollar-email-block">
            <input
              type="email"
              placeholder="tucorreo@unam.mx"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className="pollar-email-input"
            />
            <button
              type="button"
              className="pollar-send-btn"
              onClick={startEmail}
            >
              Enviar
            </button>
            {error && <p className="pollar-email-hint">{error}</p>}
          </div>

          <div className="pollar-divider">
            <span>o continuar con</span>
          </div>

          {/* OAuth: only google + github are wired in this SDK version */}
          <div className="pollar-social-list">
            <button
              type="button"
              className="pollar-social-btn"
              onClick={() => startSocial('google')}
              aria-label="Continuar con Google"
            >
              <span
                aria-hidden="true"
                style={{ width: 18, height: 18, display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: gre_google }}
              />
              Google
            </button>
            <button
              type="button"
              className="pollar-social-btn"
              onClick={() => startSocial('github')}
              aria-label="Continuar con GitHub"
            >
              <span
                aria-hidden="true"
                style={{ width: 16, height: 16, display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: gre_github }}
              />
              GitHub
            </button>
          </div>

          {/* Wallet adapters: Freighter, Albedo, ... dynamic */}
          {walletAdapters.length > 0 && (
            <>
              <div className="pollar-divider">
                <span>o con billetera</span>
              </div>
              <div className="pollar-social-list">
                {walletAdapters.map((adapter) => (
                  <button
                    key={adapter.id}
                    type="button"
                    className="pollar-social-btn"
                    onClick={() => startWallet(adapter.id, adapter.name)}
                    aria-label={`Conectar ${adapter.name}`}
                  >
                    <Wallet style={{ width: 16, height: 16 }} />
                    {adapter.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="pollar-login-footer">
            <span>Protegido por</span>
            <span
              aria-hidden="true"
              style={{ width: 14, height: 16, display: 'inline-block' }}
              dangerouslySetInnerHTML={{ __html: gre_pollar_mark }}
            />
            <strong>pollar</strong>
          </div>
        </>
      )}

      {/* Step: code-verify ------------------------------------------- */}
      {mode.kind === 'code' && (
        <>
          <h2 className="pollar-login-h2">Verifica tu correo</h2>
          <p className="pollar-modal-prompt">
            Enviamos un codigo a <strong>{mode.email}</strong>. Ingresalo
            para continuar.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 8));
              if (error) setError(null);
            }}
            className="pollar-modal-code"
            autoFocus
          />
          {error && (
            <div className="pollar-modal-error">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}
          <div className="pollar-modal-actions">
            <button
              type="button"
              className="pollar-modal-secondary"
              onClick={() => {
                setCode('');
                setError(null);
                setEmail(mode.email);
                setMode({ kind: 'choice' });
              }}
            >
              Cambiar correo
            </button>
            <button
              type="button"
              className="pollar-modal-primary"
              onClick={verifyCode}
              disabled={code.length < 4}
            >
              Verificar
            </button>
          </div>
        </>
      )}

      {/* Step: busy --------------------------------------------------- */}
      {mode.kind === 'busy' && (
        <>
          <div className="pollar-login-h2" style={{ opacity: 0.6 }}>
            {mode.provider === 'email'
              ? 'Enviando codigo...'
              : mode.provider === 'wallet'
                ? `Conectando ${mode.walletName ?? 'tu wallet'}...`
                : `Iniciando sesion con ${
                    mode.provider.charAt(0).toUpperCase() +
                    mode.provider.slice(1)
                  }...`}
          </div>
          <div className="pollar-modal-busy">
            <span className="gre-pollar-btn-spinner" aria-hidden="true" />
            <p className="pollar-modal-busy-sub">
              {mode.provider === 'email'
                ? 'Revisa tu bandeja.'
                : mode.provider === 'wallet'
                  ? 'Confirma en la extension o ventana emergente.'
                  : 'Completa la ventana emergente de Pollar y vuelve aqui.'}
            </p>
          </div>
          <button
            type="button"
            className="pollar-modal-secondary"
            onClick={cancelBusy}
          >
            <X size={12} strokeWidth={2.5} /> Cancelar
          </button>
        </>
      )}

      {/* Step: error -------------------------------------------------- */}
      {mode.kind === 'error' && (
        <>
          <h2 className="pollar-login-h2">Algo salio mal</h2>
          <div className="pollar-modal-error">
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{mode.message}</span>
          </div>
          <div className="pollar-modal-actions">
            <button
              type="button"
              className="pollar-modal-secondary"
              onClick={() => {
                setError(null);
                setMode({ kind: 'choice' });
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="pollar-modal-primary"
              onClick={() => {
                setError(null);
                setCode('');
                if (mode.backTo === 'code') {
                  setMode({ kind: 'code', email: mode.lastEmail });
                } else {
                  setEmail(mode.lastEmail);
                  setMode({ kind: 'choice' });
                }
              }}
            >
              <RefreshCw size={12} strokeWidth={2} /> reintentar
            </button>
          </div>
        </>
      )}

      <SinglePanelStyles />
    </div>
  );
}

function humanizeAdapter(id: string): string {
  // freighter-native -> Freighter; albedo-native -> Albedo; etc.
  const stripped = id.replace(/-native$/, '');
  return stripped
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

// Hoisted to module scope so we don't re-emit the @keyframes on every
// render.
function SinglePanelStyles() {
  return (
    <style>{`
      @keyframes pollar-login-card-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .pollar-login-card > * {
        animation: pollar-login-card-in 480ms
          cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .pollar-login-card > *:nth-child(1) { animation-delay: 60ms; }
      .pollar-login-card > *:nth-child(2) { animation-delay: 130ms; }
      .pollar-login-card > *:nth-child(3) { animation-delay: 200ms; }
      .pollar-login-card > *:nth-child(4) { animation-delay: 270ms; }
      .pollar-login-card > *:nth-child(5) { animation-delay: 340ms; }
      .pollar-login-card > *:nth-child(6) { animation-delay: 410ms; }
      .pollar-login-card > *:nth-child(7) { animation-delay: 480ms; }
      .pollar-login-card > *:nth-child(8) { animation-delay: 550ms; }
      @media (prefers-reduced-motion: reduce) {
        .pollar-login-card > * { animation: none; }
      }
    `}</style>
  );
}
