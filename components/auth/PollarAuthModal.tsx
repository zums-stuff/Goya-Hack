// components/auth/PollarAuthModal.tsx -- Gremium-built auth modal that
// calls Pollar's underlying client directly. Visually matches
// https://www.pollar.xyz/interactive-demo (close enough to be
// recognizable). Bypasses PollarProvider's <LoginModal> template,
// which has been observed to fall back to the degraded
// <LoginModalStatus> pane when it can't fully parse /applications/config
// or when its style plumbing breaks under certain bundler conditions.

'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Apple, Mail, RefreshCw, Wallet, X } from 'lucide-react';
import { usePollar } from '@pollar/react';
import { gre_github, gre_pollar_mark } from './pollar-svgs';

type Step = 'root' | 'code' | 'auth' | 'error';

type OAuthProvider = 'google' | 'apple' | 'x' | 'github';

export function PollarAuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    isAuthenticated,
    verified,
    wallet,
    wallets,
    getClient,
    logout,
  } = usePollar();

  const [step, setStep] = useState<Step>('root');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | 'wallet' | null>(
    null,
  );
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
    void runSync(stellarAddress);
  }, [isAuthenticated, verified, stellarAddress, getClient]);

  async function runSync(address: string) {
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
      window.location.assign('/home');
    } catch (e) {
      setStep('error');
      setError((e as Error).message);
      fired.current = false;
    }
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function reset() {
    setStep('root');
    setEmail('');
    setCode('');
    setError(null);
    setBusyProvider(null);
  }

  async function startEmail() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Escribe un correo valido.');
      return;
    }
    setError(null);
    setStep('code');
    try {
      await getClient().sendEmailCode(trimmed);
    } catch (e) {
      setStep('root');
      setError((e as Error).message);
    }
  }

  async function verifyCode() {
    if (code.trim().length < 4) {
      setError('Escribe el codigo que te enviamos.');
      return;
    }
    setError(null);
    try {
      await getClient().verifyEmailCode(code.trim());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function startSocial(provider: OAuthProvider) {
    setError(null);
    setBusyProvider(provider);
    setStep('auth');
    try {
      getClient().login({ provider });
    } catch (e) {
      setStep('root');
      setBusyProvider(null);
      setError((e as Error).message);
    }
  }

  async function startWallet() {
    setError(null);
    setBusyProvider('wallet');
    setStep('auth');
    try {
      getClient().login({ provider: 'embedded' });
    } catch (e) {
      setStep('root');
      setBusyProvider(null);
      setError((e as Error).message);
    }
  }

  function cancelAuthAndClose() {
    try {
      getClient().cancelLogin();
    } catch {
      // ignore
    }
    logout();
    reset();
    onClose();
  }

  return (
    <div
      className="pollar-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar sesion con Pollar"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pollar-modal-card">
        <button
          type="button"
          className="pollar-modal-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        <div className="pollar-modal-header">
          <div className="pollar-modal-mark">
            <img src="/Logo_Gremium.png" alt="Gremium" width={48} height={48} />
          </div>
          <h2 className="pollar-modal-title">Gremium</h2>
          <p className="pollar-modal-subtitle">
            Iniciar sesion o registrarse
          </p>
        </div>

        {step === 'root' && (
          <div className="pollar-modal-body">
            <div className="pollar-modal-email">
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pollar-modal-input"
                autoFocus
              />
              <button
                type="button"
                className="pollar-modal-primary"
                disabled={email.trim().length === 0}
                onClick={startEmail}
              >
                Enviar
              </button>
            </div>

            <div className="pollar-modal-divider">
              <div className="pollar-modal-divider-line" />
              <span className="pollar-modal-divider-label">o continuar con</span>
            </div>

            <div className="pollar-modal-socials">
              <button
                type="button"
                className="pollar-modal-social"
                onClick={() => startSocial('google')}
              >
                <span className="pollar-modal-social-icon">
                  <GoogleIcon />
                </span>
                Google
              </button>
              <button
                type="button"
                className="pollar-modal-social"
                onClick={() => startSocial('apple')}
              >
                <span className="pollar-modal-social-icon">
                  <Apple size={14} strokeWidth={2} />
                </span>
                Apple
              </button>
              <button
                type="button"
                className="pollar-modal-social"
                onClick={() => startSocial('x')}
              >
                <span className="pollar-modal-social-icon">
                  <X size={14} strokeWidth={2} />
                </span>
                X (Twitter)
              </button>
              <button
                type="button"
                className="pollar-modal-social"
                onClick={() => startSocial('github')}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    display: 'inline-block',
                  }}
                  dangerouslySetInnerHTML={{ __html: gre_github }}
                />
                GitHub
              </button>
            </div>

            <button
              type="button"
              className="pollar-modal-wallet"
              onClick={startWallet}
            >
              <Wallet size={16} strokeWidth={2} />
              Continuar con una billetera
            </button>

            {error && (
              <div className="pollar-modal-error">
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
            )}

            <div className="pollar-modal-foot">
              <span>Protegido por</span>
              <span
                className="pollar-modal-foot-mark"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: gre_pollar_mark }}
              />
              <strong>pollar</strong>
            </div>
          </div>
        )}

        {step === 'code' && (
          <div className="pollar-modal-body">
            <p className="pollar-modal-prompt">
              Ingresa el codigo que enviamos a <strong>{email}</strong>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 8))
              }
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
                  setStep('root');
                  setError(null);
                  setCode('');
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
          </div>
        )}

        {step === 'auth' && (
          <div className="pollar-modal-body">
            <div className="pollar-modal-busy">
              <span className="gre-pollar-btn-spinner" aria-hidden="true" />
              <p>
                {busyProvider === 'wallet'
                  ? 'Conectando tu wallet Pollar...'
                  : busyProvider === 'apple'
                    ? 'Iniciando sesion con Apple...'
                    : busyProvider === 'x'
                      ? 'Iniciando sesion con X...'
                      : busyProvider === 'github'
                        ? 'Iniciando sesion con GitHub...'
                        : 'Iniciando sesion con Google...'}
              </p>
              <p className="pollar-modal-busy-sub">
                Completa la ventana emergente y vuelve aqui.
              </p>
            </div>
            <button
              type="button"
              className="pollar-modal-secondary"
              onClick={cancelAuthAndClose}
            >
              Cancelar
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="pollar-modal-body">
            <div className="pollar-modal-error">
              <AlertCircle size={14} />
              <span style={{ flex: 1 }}>{error}</span>
            </div>
            <div className="pollar-modal-actions">
              <button
                type="button"
                className="pollar-modal-secondary"
                onClick={onClose}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="pollar-modal-primary"
                onClick={() => {
                  setBusyProvider(null);
                  setStep('root');
                  setError(null);
                  logout();
                }}
              >
                <RefreshCw size={12} strokeWidth={2} />
                reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
