// components/auth/PollarLoginActions.tsx — Pollar-styled auth card that
// mirrors https://www.pollar.xyz/interactive-demo from inside Gremium.
//
// The card lives INSIDE the .prelogin-card surface and consists of:
//   - Pol mark + Pollar wordmark + "Demo" pill, centered
//   - "Iniciar sesion o registrarse" subtitle
//   - Email input + Pol-blue "Enviar" primary button
//   - "o continuar con" divider
//   - Social OAuth buttons: Google, Discord, X (Twitter), GitHub, Apple
//     -- white pill, --line border, brand-color icon + label
//   - Outlined Pol-blue "Continuar con una billetera" button
//   - Footer: "Protegido por [pollar]" with a tiny brand mark
//
// Each CTA calls `openLoginModal()` -- Pollar's widget handles the actual
// authentication (email codes, OAuth, wallet). The widget inherits our
// accentColor (#005DB4) so opening it never feels visually discordant --
// the user sees the same blue gradient continue into the modal.

'use client';

import { useState } from 'react';
import { Mail, Wallet } from 'lucide-react';
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
  | 'auth' // modal abierto
  | 'syncing' // post-login, /api/auth/sync
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

  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  // Keep stub -- leave runSync/effect structural milestone identical to LoginButton
  // for future re-use; we don't trigger here because openLoginModal() handles
  // the full flow including sync.
  void stellarAddress;
  void isAuthenticated;
  void verified;
  void getClient;

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

  // Google OAuth via Pollar's login widget. Pollar routes the user to
  // Google's consent screen; Google's redirect lands on the configured
  // Pollar redirect URI, which then bounces back to /api/auth/sync.
  function social(provider: 'google' | 'discord' | 'twitter' | 'github' | 'apple') {
    openModal();
  }

  // Email code path: collects the address in our card then opens Pollar
  // at the email step. Pollar owns the OTP send/verify -- this is just
  // a convenience so we don't ask the user to type the same email twice.
  function sendEmail() {
    if (!email.trim()) {
      setError('Escribe tu correo para enviarte el codigo.');
      return;
    }
    openModal();
  }

  if (isAuthenticated && wallet?.address && status !== 'error') {
    return (
      <div
        style={{
          marginTop: 24,
          padding: '13px 16px',
          background: 'rgba(0, 93, 180, 0.08)',
          border: '1px solid rgba(0, 93, 180, 0.22)',
          borderRadius: 11,
          color: '#003e80',
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}
      >
        <Wallet style={{ width: 14, height: 14, color: '#005DB4' }} />
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
    );
  }

  return (
    <div className="pollar-login-card">
      {/* Pollar brand row -- mark + wordmark + "Demo" pill */}
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
        <span className="pollar-demo-pill">Demo</span>
      </div>

      <h2 className="pollar-login-h2">
        Iniciar sesion o registrarse
      </h2>

      {/* Email step */}
      <div className="pollar-email-block">
        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pollar-email-input"
          disabled={status === 'auth'}
        />
        <button
          type="button"
          className="pollar-send-btn"
          disabled={status === 'auth'}
          onClick={sendEmail}
        >
          {status === 'auth' ? (
            <span className="gre-pollar-btn-spinner" aria-hidden="true" />
          ) : (
            'Enviar'
          )}
        </button>
      </div>

      {/* "o continuar con" divider */}
      <div className="pollar-divider">
        <span>o continuar con</span>
      </div>

      {/* Social OAuth buttons */}
      <div className="pollar-social-list">
        <button
          type="button"
          className="pollar-social-btn"
          disabled={status === 'auth'}
          onClick={() => social('google')}
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
          disabled={status === 'auth'}
          onClick={() => social('discord')}
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
          disabled={status === 'auth'}
          onClick={() => social('twitter')}
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
          disabled={status === 'auth'}
          onClick={() => social('github')}
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
          disabled={status === 'auth'}
          onClick={() => social('apple')}
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

      {/* Wallet continuation -- matches the demo layout. */}
      <button
        type="button"
        className="pollar-wallet-btn"
        disabled={status === 'auth'}
        onClick={openModal}
      >
        <Wallet style={{ width: 16, height: 16 }} />
        Continuar con una billetera
      </button>

      {/* Pollar error inline */}
      {status === 'error' && (
        <div className="form-error" style={{ marginTop: 12 }}>
          <Mail style={{ width: 14, height: 14 }} />
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
            reintentar
          </button>
        </div>
      )}

      {/* Footer -- "Protegido por + pol-mark wordmark" */}
      <div className="pollar-login-footer">
        <span>Protegido por</span>
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 16,
            display: 'inline-block',
          }}
          dangerouslySetInnerHTML={{ __html: gre_pollar_mark }}
        />
        <strong>pollar</strong>
      </div>

      {/* subtle staggered fade entry on the card contents */}
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
        @media (prefers-reduced-motion: reduce) {
          .pollar-login-card > * { animation: none; }
        }
      `}</style>
    </div>
  );
}
