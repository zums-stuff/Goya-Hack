// components/auth/PollarLoginActions.tsx -- Gremium-branded Pollar auth
// trigger. The card on the page itself shows the Pollar demo aesthetic
// (email field + social list + outlined wallet) AND drives the auth
// flow end-to-end without opening any secondary modal. We use a
// single-panel UX: the card transitions through the auth steps in
// place ("Iniciar sesion" -> "Verificar codigo" -> "Iniciando
// sesion con Google..." -> "Sesion activa / Recargando..."). For
// OAuth, Pollar opens its own browser popup at
// https://api.pollar.xyz/auth/<provider> -- that's the only external
// surface during an OAuth round-trip, and it's an unavoidable Pollar
// SDK behaviour (logged in core as `defaultWebOAuthOpener =
// async ({ getUrl }) => { popup = window.open("about:blank",
// "_blank"); ... popup.location.href = url; }`). The card transitions
// to a busy spinner while that popup is open and back to /home once
// the wallet binds.
//
// Sync lives here directly (no separate modal) because:
//   1. PollarLoginActions is ALWAYS mounted while the user is on /
//      -- there is no component that unmounts when auth flips, so
//      the useEffect that runs runSync is reliable.
//   2. Backup setTimeout redirects to /home after 2.5s if /api/auth/sync
//      is slow, and a manual "Ir al dashboard" button skips the wait.

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
  gre_apple,
  gre_discord,
  gre_github,
  gre_google,
  gre_twitter,
  gre_pollar_mark,
} from './pollar-svgs';

type OAuthProvider = 'google' | 'apple' | 'x' | 'github';

type Mode =
  | { kind: 'choice' }                       // show email + socials + wallet
  | { kind: 'code'; email: string }           // show code-verify input
  | { kind: 'busy'; provider: 'email' | OAuthProvider | 'wallet' | 'embedded' }
  | { kind: 'error'; message: string; backTo: 'choice' | 'code'; lastEmail: string };

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
  const fired = useRef(false);
  const fallbackTimer = useRef<number | null>(null);

  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  // runSync lives here, not in a modal that might unmount. Fires once on
  // wallet binding, posts to /api/auth/sync, redirects to /home on
  // success. Belt-and-suspenders with the manual "Ir al dashboard"
  // button + 2.5s fallback timer.
  useEffect(() => {
    if (fired.current) return;
    if (!isAuthenticated || !verified) return;
    if (!stellarAddress || !stellarAddress.startsWith('G')) return;
    fired.current = true;
    void runSync(stellarAddress);
  }, [isAuthenticated, verified, stellarAddress, getClient]);

  useEffect(() => {
    if (!isAuthenticated || !wallet?.address) return;
    if (fallbackTimer.current !== null) return;
    fallbackTimer.current = window.setTimeout(() => {
      window.location.assign('/home');
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
    } catch {
      // Sync failed but wallet is bound in Pollar. Fallback timer
      // will take the user to /home in 2.5s.
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
      setMode({ kind: 'error', message: (e as Error).message, backTo: 'choice', lastEmail: trimmed });
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
      setMode({ kind: 'error', message: (e as Error).message, backTo: 'code', lastEmail });
    }
  }

  async function startSocial(provider: OAuthProvider) {
    setError(null);
    setMode({ kind: 'busy', provider });
    try {
      getClient().login({ provider });
    } catch (e) {
      setMode({ kind: 'error', message: (e as Error).message, backTo: 'choice', lastEmail: email });
    }
  }

  function startWallet() {
    setError(null);
    setMode({ kind: 'busy', provider: 'wallet' });
    try {
      getClient().login({ provider: 'embedded' });
    } catch (e) {
      setMode({ kind: 'error', message: (e as Error).message, backTo: 'choice', lastEmail: email });
    }
  }

  function cancelBusy() {
    try {
      getClient().cancelLogin();
    } catch {
      // ignore
    }
    try {
      logout();
    } catch {
      // ignore
    }
    setMode({ kind: 'choice' });
    setError(null);
  }

  // === Already-authenticated: success card, single panel =================
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
        <h2 className="pollar-login-h2">Sesion activa</h2>
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
        <p className="pollar-status-sub">
          Recargando al dashboard...
        </p>
        <button
          type="button"
          className="pollar-modal-primary"
          style={{ marginTop: 4 }}
          onClick={() => window.location.assign('/home')}
        >
          Ir al dashboard
        </button>
        <button
          type="button"
          className="gre-pillar-btn-retry"
          style={{ marginTop: 8 }}
          onClick={() => logout()}
        >
          Cerrar sesion
        </button>
        <SinglePanelStyles />
      </div>
    );
  }

  // === Authed success card = single panel. Email-OTP, busy, error all
  //     render INSIDE this same card -- no overlay, no second panel.
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
              onClick={() => startSocial('apple')}
              aria-label="Continuar con Apple"
            >
              <span
                aria-hidden="true"
                style={{ width: 14, height: 14, display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: gre_apple }}
              />
              Apple
            </button>
            <button
              type="button"
              className="pollar-social-btn"
              onClick={() => startSocial('x')}
              aria-label="Continuar con X (Twitter)"
            >
              <span
                aria-hidden="true"
                style={{ width: 14, height: 14, display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: gre_twitter }}
              />
              X (Twitter)
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
            <button
              type="button"
              className="pollar-social-btn"
              onClick={() => /* Pollar SDK only exposes google/apple/x/github + embedded in login({provider}); Discord is reachable via wallet providers separately */ null}
              aria-label="Continuar con Discord"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <span
                aria-hidden="true"
                style={{ width: 18, height: 18, display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: gre_discord }}
              />
              Discord
            </button>
          </div>

          <button
            type="button"
            className="pollar-wallet-btn"
            onClick={startWallet}
          >
            <Wallet style={{ width: 16, height: 16 }} />
            Continuar con una billetera
          </button>

          <p className="pollar-footnote">
            Google, Apple, X, GitHub requieren un{' '}
            <strong>redirect URI</strong> configurado en{' '}
            <a
              href="https://dashboard.pollar.xyz"
              target="_blank"
              rel="noreferrer"
            >
              dashboard.pollar.xyz
            </a>{' '}
            - Apps - Gremium Usuarios - Settings. Sin eso, OAuth muestra{' '}
            <code>APPLICATION_HAS_NO_REDIRECT_URIS</code>. Email y wallet
            funcionan sin esa configuracion.
          </p>

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
                ? 'Conectando tu wallet Pollar...'
                : `Iniciando sesion con ${
                    mode.provider.charAt(0).toUpperCase() + mode.provider.slice(1)
                  }...`}
          </div>
          <div className="pollar-modal-busy">
            <span className="gre-pollar-btn-spinner" aria-hidden="true" />
            <p className="pollar-modal-busy-sub">
              {mode.provider === 'email'
                ? 'Revisa tu bandeja.'
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

// Inline keyframes for the login-card fade-in. Hoisted to module scope
// so we don't re-emit the @keyframes on every render.
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
