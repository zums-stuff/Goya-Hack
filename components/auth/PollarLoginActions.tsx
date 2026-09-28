// components/auth/PollarLoginActions.tsx -- Gremium-branded Pollar auth
// trigger. The card on the page itself shows the Pollar demo aesthetic
// (email field + social list + outlined wallet). Clicking any CTA now
// opens <PollarAuthModal> -- our own fully-styled modal that calls
// Pollar's underlying getClient() directly.
//
// Why we don't use PollarProvider's own openLoginModal(): the SDK
// falls back to <LoginModalStatus> ("Could not load sign-in options.")
// on certain bundler / hydration paths, even when appConfig is passed.
// Building the layout ourselves guarantees a Pollar-styled UI that we
// fully control. The actual auth still flows through Pollar's SDK --
// we just draw the surface that hosts it.

'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, Mail, RefreshCw, Wallet } from 'lucide-react';
import { usePollar } from '@pollar/react';
import {
  gre_apple,
  gre_discord,
  gre_github,
  gre_google,
  gre_twitter,
  gre_pollar_mark,
} from './pollar-svgs';
import { PollarAuthModal } from './PollarAuthModal';

type Status =
  | 'idle'
  | 'auth' // modal abierto (clicked a button)
  | 'syncing' // wallet bound, POST /api/auth/sync
  | 'error';

export function PollarLoginActions() {
  const {
    openLoginModal: _unused, // ignored -- we use PollarAuthModal instead
    isAuthenticated,
    verified,
    wallet,
    wallets,
  } = usePollar();
  void _unused;

  const [status] = useState<Status>('idle');
  const [error] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [useEmailInModal, setUseEmailInModal] = useState(false);
  // Run sync exactly once per verified session; reset on error.
  const fired = useRef(false);

  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  useEffect(() => {
    if (fired.current) return;
    if (!isAuthenticated || !verified) return;
    if (!stellarAddress || !stellarAddress.startsWith('G')) return;
    fired.current = true;
    // Hand off to PollarAuthModal -- it owns the sync from now on.
    setModalOpen(true);
  }, [isAuthenticated, verified, stellarAddress]);

  // If the wallet already binds (e.g. user loads the page already authed),
  // surface a quiet success pill instead of the action card. In practice
  // the redirect to /home should have already happened, but this is the
  // safety net.
  if (isAuthenticated && wallet?.address && status !== 'error') {
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
        <p className="pollar-status-sub">Recargando al dashboard...</p>
      </div>
    );
  }

  function openModal(prefillEmail: boolean) {
    if (prefillEmail) {
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError('Escribe un correo valido para enviarte el codigo.');
        return;
      }
      setEmailError(null);
      setUseEmailInModal(true);
    } else {
      setUseEmailInModal(false);
      setEmailError(null);
    }
    setModalOpen(true);
  }

  const setBusyAndOpen = () => {
    setEmailError(null);
    setUseEmailInModal(false);
    setModalOpen(true);
  };

  void status; // silence unused warnings; reserved for inline error pill
  void error;

  return (
    <>
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

        <h2 className="pollar-login-h2">Iniciar sesion o registrarse</h2>

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
          />
          <button
            type="button"
            className="pollar-send-btn"
            onClick={() => openModal(true)}
          >
            Enviar
          </button>
          {emailError && (
            <p className="pollar-email-hint">{emailError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="pollar-divider">
          <span>o continuar con</span>
        </div>

        {/* Social OAuth buttons -- each opens our PollarAuthModal which
            dispatches to Pollar's client.login({provider: ...}). Pollar's
            pop-up window handles the OAuth dance; we control the surface
            shown to the user in this app. */}
        <div className="pollar-social-list">
          <button
            type="button"
            className="pollar-social-btn"
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
          onClick={setBusyAndOpen}
        >
          <Wallet style={{ width: 16, height: 16 }} />
          Continuar con una billetera
        </button>

        {/* Persistent footnote about OAuth callback URLs -- the dashboard
            step the user has to fix on their Pollar account. We can't
            solve this from app code. */}
        <p className="pollar-footnote">
          Google, Discord y los demas requieren un{' '}
          <strong>redirect URI</strong> configurado en{' '}
          <a href="https://dashboard.pollar.xyz" target="_blank" rel="noreferrer">
            dashboard.pollar.xyz
          </a>{' '}
          - Apps - Gremium Usuarios - Settings. Sin eso, Google muestra{' '}
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

      <PollarAuthModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEmailError(null);
        }}
      />
    </>
  );
}
