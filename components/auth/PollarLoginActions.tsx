// components/auth/PollarLoginActions.tsx -- Pollar-styled auth card that
// mirrors https://www.pollar.xyz/interactive-demo from inside Gremium.
//
// Card layout (top to bottom):
//   - Pol mark + Pollar wordmark + "Demo" pill, centered
//   - "Iniciar sesion o registrarse" subtitle
//   - Email field + Pol-blue "Enviar" primary button (min 2 chars or show error)
//   - "o continuar con" divider
//   - Social OAuth buttons: Google, Discord, X, GitHub, Apple
//   - Outlined Pol-blue "Continuar con una billetera" button
//   - Footer "Protegido por [pol-mark] pollar"
//
// Auth flow:
//   - Each CTA calls openLoginModal(). Pollar's widget renders on top
//     with the theme/accentColor from layout.tsx's appConfig, so it
//     matches our card visually.
//   - We watch isAuthenticated + verified + wallet via useEffect and
//     POST /api/auth/sync to bind the wallet in our DB, then redirect
//     to /home. Same pattern as <LoginButton />.
//   - On error, we render an inline form-error pill that calls logout()
//     on retry, restoring the unsigned state.

'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mail, RefreshCw, Wallet } from 'lucide-react';
import { usePollar } from '@pollar/react';
import {
  gre_apple,
  gre_discord,
  gre_github,
  gre_google,
  gre_twitter,
  gre_pollar_mark,
} from './pollar-svgs';

type Status =
  | 'idle'
  | 'auth' // modal abierto (clicked a button)
  | 'syncing' // wallet bound, POST /api/auth/sync
  | 'error';

export function PollarLoginActions() {
  const {
    openLoginModal,
    isAuthenticated,
    verified,
    wallet,
    wallets,
    getClient,
    logout,
  } = usePollar();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // Run sync exactly once per verified session; reset on error so a retry
  // does not spam the sync endpoint.
  const fired = useRef(false);

  // Pick the Stellar wallet specifically. Pollar supports multi-chain and
  // Gremium is Stellar-only. /api/auth/sync validates the address.
  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  useEffect(() => {
    if (fired.current) return;
    if (!isAuthenticated || !verified) return;
    if (!stellarAddress || !stellarAddress.startsWith('G')) return;
    fired.current = true;
    void runSync(stellarAddress);
  }, [isAuthenticated, verified, stellarAddress, getClient]);

  async function runSync(address: string) {
    setStatus('syncing');
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
          displayName = mail?.split('@')[0] ?? `user_${address.slice(0, 6)}`;
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
      // Cookie set by server; reload so server-rendered pages read it.
      window.location.assign('/home');
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
      fired.current = false; // allow retry on next verify event
    }
  }

  function openModal() {
    setStatus('auth');
    setError(null);
    try {
      openLoginModal();
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }

  // Email step: validate, then open Pollar at the email prefill step.
  function sendEmail() {
    const trimmed = email.trim();
    if (trimmed.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Escribe un correo valido para enviarte el codigo.');
      return;
    }
    setEmailError(null);
    openModal();
  }

  if (isAuthenticated && wallet?.address && status !== 'error') {
    return (
      <div className="pollar-login-card">
        <div className="pollar-login-brandrow">
          <span
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
          <span className="pollar-demo-pill">Demo</span>
        </div>
        <h2 className="pollar-login-h2">Vinculando tu wallet</h2>
        <div
          className="form-success-pill"
          style={{ marginTop: 12 }}
        >
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
          {status === 'syncing'
            ? 'Confirmando en la base de datos...'
            : 'Listo. Recargando al dashboard...'}
        </p>
      </div>
    );
  }

  const isBusy = status === 'auth';
  const setBusyAndOpen = () => {
    setStatus('auth');
    setError(null);
    openModal();
  };

  return (
    <div className="pollar-login-card">
      {/* Pollar brand row */}
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
        Iniciar sesion o registrarse
      </h2>

      {/* Email step with validation */}
      <div className="pollar-email-block">
        <input
          type="email"
          placeholder="tucorreo@unam.mx"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          className="pollar-email-input"
          disabled={isBusy}
        />
        <button
          type="button"
          className="pollar-send-btn"
          disabled={isBusy}
          onClick={sendEmail}
        >
          {isBusy ? (
            <span className="gre-pollar-btn-spinner" aria-hidden="true" />
          ) : (
            'Enviar'
          )}
        </button>
        {emailError && (
          <p className="pollar-email-hint">{emailError}</p>
        )}
      </div>

      {/* "o continuar con" divider */}
      <div className="pollar-divider">
        <span>o continuar con</span>
      </div>

      {/* Social OAuth buttons -- all routes via Pollar's openLoginModal().
          Pollar handles the actual OAuth dance; we never see the user
          bounce back via Google's own redirect_uri because Pollar owns
          the callback chain. Each provider here just signals "this is the
          brand the user wants to log in with" to Pollar. */}
      <div className="pollar-social-list">
        <button
          type="button"
          className="pollar-social-btn"
          disabled={isBusy}
          onClick={setBusyAndOpen}
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
          disabled={isBusy}
          onClick={setBusyAndOpen}
          aria-label="Continuar con Discord"
        >
          <span
            aria-hidden="true"
            style={{ width: 18, height: 18, display: 'inline-block' }}
            dangerouslySetInnerHTML={{ __html: gre_discord }}
          />
          Discord
        </button>
        <button
          type="button"
          className="pollar-social-btn"
          disabled={isBusy}
          onClick={setBusyAndOpen}
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
          disabled={isBusy}
          onClick={setBusyAndOpen}
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
          disabled={isBusy}
          onClick={setBusyAndOpen}
          aria-label="Continuar con Apple"
        >
          <span
            aria-hidden="true"
            style={{ width: 14, height: 14, display: 'inline-block' }}
            dangerouslySetInnerHTML={{ __html: gre_apple }}
          />
          Apple
        </button>
      </div>

      <button
        type="button"
        className="pollar-wallet-btn"
        disabled={isBusy}
        onClick={setBusyAndOpen}
      >
        {isBusy ? (
          <span className="gre-pollar-btn-spinner" aria-hidden="true" />
        ) : (
          <Wallet style={{ width: 16, height: 16 }} />
        )}
        Continuar con una billetera
      </button>

      {/* Inline error pill from /api/auth/sync, plus a reintentar button
          that calls usePollar().logout() to restore the unsigned state. */}
      {status === 'error' && (
        <div className="form-error" style={{ marginTop: 12 }}>
          <AlertCircle style={{ width: 14, height: 14 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              setError(null);
              logout();
            }}
            className="gre-pillar-btn-retry"
          >
            <RefreshCw style={{ width: 11, height: 11 }} />
            reintentar
          </button>
        </div>
      )}

      {/* Persistent footnote about the redirect URI for OAuth providers
          -- users see this and know that Pollar's own dashboard has to
          have at least one redirect URI registered for the OAuth flow
          to complete. App-side, we can't fix this. */}
      <p className="pollar-footnote">
        Google, Discord y los demas requieren un{' '}
        <strong>redirect URI</strong> configurado en{' '}
        <a
          href="https://dashboard.pollar.xyz"
          target="_blank"
          rel="noreferrer"
        >
          dashboard.pollar.xyz
        </a>{' '}
        - Apps - Gremium Usuarios - Settings. Sin esto, Google muestra{' '}
        <code>APPLICATION_HAS_NO_REDIRECT_URIS</code>.
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

      {/* Staggered child fade-in, reduced-motion safe. */}
      <style>{`
        @keyframes pollar-login-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pollar-login-card > * {
          animation: pollar-login-card-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pollar-login-card > *:nth-child(1) { animation-delay: 60ms; }
        .pollar-login-card > *:nth-child(2) { animation-delay: 130ms; }
        .pollar-login-card > *:nth-child(3) { animation-delay: 200ms; }
        .pollar-login-card > *:nth-child(4) { animation-delay: 270ms; }
        .pollar-login-card > *:nth-child(5) { animation-delay: 340ms; }
        .pollar-login-card > *:nth-child(6) { animation-delay: 410ms; }
        .pollar-login-card > *:nth-child(7) { animation-delay: 480ms; }
        .pollar-login-card > *:nth-child(8) { animation-delay: 550ms; }
        .pollar-login-card > *:nth-child(9) { animation-delay: 620ms; }
        @media (prefers-reduced-motion: reduce) {
          .pollar-login-card > * { animation: none; }
        }
      `}</style>
    </div>
  );
}
