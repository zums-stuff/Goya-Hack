// components/auth/PollarLoginActions.tsx -- Gremium-branded Pollar auth
// trigger. The card on the page itself shows the Pollar demo aesthetic
// (email field + social list + outlined wallet). Clicking any CTA opens
// <PollarAuthModal>, our own modal that drives Pollar's auth APIs.
//
// Sync lives here (not in PollarAuthModal) because:
//   1. PollarLoginActions is ALWAYS mounted while the user is on /, so
//      the useEffect that runs runSync is reliable. PollarAuthModal
//      unmounts when we transition to the "Sesion activa" success
//      state, so its useEffect can lose the post-auth callback in
//      flight.
//   2. Backup setTimeout redirects to /home after 2.5s even if the
//      sync returns nothing -- defensive belt in case the cookie round-
//      trip is slow or /api/auth/sync is briefly unreachable.
//
// For OAuth (Google/Apple/X/GitHub): Pollar opens its own popup
// (`window.open("about:blank", "_blank")` then redirects to Pollar's
// auth URL). Our modal just shows "we're opening it"; the user's
// interaction is with the popup. After OAuth completes, Pollar binds
// the wallet in the parent window via postMessage/session cookies.

'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mail, Wallet } from 'lucide-react';
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

export function PollarLoginActions() {
  const {
    openLoginModal: _unused,
    isAuthenticated,
    verified,
    wallet,
    wallets,
    getClient,
    logout,
  } = usePollar();
  void _unused;

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const fired = useRef(false);
  const fallbackTimer = useRef<number | null>(null);

  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  // Belt-and-suspenders: runSync runs from here AND from PollarAuthModal.
  // Both use their own fired ref so they don't fire twice; whichever
  // component detects the verified state first posts to /api/auth/sync
  // and sets window.location('/home'). The other component's effect
  // short-circuits on fired.current.
  useEffect(() => {
    if (fired.current) return;
    if (!isAuthenticated || !verified) return;
    if (!stellarAddress || !stellarAddress.startsWith('G')) return;
    fired.current = true;
    void runSync(stellarAddress);
  }, [isAuthenticated, verified, stellarAddress, getClient]);

  // Last-resort fallback: 2.5s after we see the wallet bound, just
  // hard-navigate to /home. Useful when /api/auth/sync is slow or stuck.
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
      // Reload to /home so server pages render with the new cookie.
      window.location.assign('/home');
    } catch {
      // Sync failed but the wallet IS bound in Pollar. Keep the
      // fallback timer alive; it kicks them over to /home a moment
      // later even without the modal-side redirect.
    }
  }

  function openModal(prefillEmail: boolean) {
    if (prefillEmail) {
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError('Escribe un correo valido para enviarte el codigo.');
        return;
      }
      setEmailError(null);
    } else {
      setEmailError(null);
    }
    setModalOpen(true);
  }

  const setBusyAndOpen = () => {
    setEmailError(null);
    setModalOpen(true);
  };

  // If we're already authenticated but the sync round-trip didn't fire
  // (due to timing of wallet-bound events), show "Sesion activa" and
  // rely on the fallback setTimeout. The button "Ir al dashboard" lets
  // the user skip the wait and navigate immediately.
  if (isAuthenticated && wallet?.address) {
    return (
      <>
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
        </div>
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
          @media (prefers-reduced-motion: reduce) {
            .pollar-login-card > * { animation: none; }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
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

        <h2 className="pollar-login-h2">Iniciar sesion o registrarse</h2>

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
          {emailError && <p className="pollar-email-hint">{emailError}</p>}
        </div>

        <div className="pollar-divider">
          <span>o continuar con</span>
        </div>

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
