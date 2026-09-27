// scripts/e2e-demo.ts — Lightweight end-to-end smoke (POST-boot).
//
// Use:
//   npm run boot  # in one terminal — DB + migrations + seed + dev server
//   npm run dev   # if boot.sh didn't already start the dev server
//   npm run e2e:demo   # in another terminal — this script
//
// Asserts:
//   1. GET /                       → 200
//   2. GET /api/auth/dev-users     → 200 with seed users (NODE_ENV != 'production')
//   3. POST /api/auth/dev-login    → 200 with body { user } (dev only)
//   4. GET /api/auth/me with the cookie from #3 → 200 with the same user
//   5. GET /api/fx                  → 200 (rate endpoint exists)
//
// This is not a substitute for vitest. It's the closest thing to a click-the-
// buttons smoke we have for `/health` outside the UI. Add cases here when
// you ship a route you want every demo to confirm works.
//
// Exit code: 0 on all-green, 1 on first failure (subsequent cases still run).

import { loadEnvOnce } from '../lib/load-env';
loadEnvOnce();

const BASE = process.env.E2E_BASE ?? `http://localhost:${process.env.PORT ?? '3000'}`;

type Step = { name: string; ok: boolean; status?: number; detail?: string };
const steps: Step[] = [];

function recordFailure(name: string, detail: string, status?: number) {
  steps.push({ name, ok: false, status, detail });
  console.log(`  ❌ ${name}${status ? ` (HTTP ${status})` : ''} — ${detail}`);
}

function recordSuccess(name: string, status: number, extra?: string) {
  steps.push({ name, ok: true, status });
  console.log(`  ✔ ${name} (HTTP ${status})${extra ? ` — ${extra}` : ''}`);
}

async function check(label: string, req: Promise<Response>, expect: number[], validate?: (body: unknown) => string | null) {
  let res: Response;
  try {
    res = await req;
  } catch (e) {
    recordFailure(label, `network: ${(e as Error).message}`);
    return null;
  }
  if (!expect.includes(res.status)) {
    recordFailure(label, `expected ${expect.join('|')}, got ${res.status}`, res.status);
    return null;
  }
  let parsed: unknown = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try { parsed = await res.json(); } catch { /* ignore */ }
  }
  if (validate) {
    const v = validate(parsed);
    if (v) { recordFailure(label, v, res.status); return null; }
  }
  const extra = parsed && typeof parsed === 'object' ? summarize(parsed) : '';
  recordSuccess(label, res.status, extra);
  return parsed;
}

function summarize(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const obj = body as Record<string, unknown>;
  if (typeof obj.user === 'object' && obj.user) {
    const u = obj.user as { email?: string; displayName?: string };
    if (u.email) return `user=${u.email}`;
  }
  if (Array.isArray(obj.users)) return `count=${(obj.users as unknown[]).length}`;
  if (typeof obj.rate === 'number' && typeof obj.source === 'string') {
    return `rate=${obj.rate} (${obj.source})`;
  }
  return '';
}

async function main() {
  console.log(`\n  Gremium · E2E smoke (${BASE})\n  ${'─'.repeat(48)}\n`);
  console.log('  Waiting for server…\n');

  // 1. Server up
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth/me`, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status === 200 || r.status === 401) break;
    } catch {/* not up yet */}
    await new Promise((r) => setTimeout(r, 1000));
  }

  await check('GET  /', fetch(`${BASE}/`), [200]);
  await check('GET  /api/auth/me (no session)', fetch(`${BASE}/api/auth/me`), [200]);

  const devUsersResp = await check(
    'GET  /api/auth/dev-users',
    fetch(`${BASE}/api/auth/dev-users`),
    [200, 404],
    (b) => {
      const u = (b as { users?: unknown[] } | null)?.users;
      if (!u) return null;
      if (!Array.isArray(u) || u.length === 0) return 'no users returned (seed missing?)';
      return null;
    },
  );
  type DevUser = { email: string };
  const users = ((devUsersResp as { users?: DevUser[] } | null)?.users ?? []) as DevUser[];
  // 404 means dev-login is disabled in this env (NODE_ENV=production or
  // DEV_LOGIN_ENABLED unset) — that's expected, not a failure.
  if (devUsersResp === null) {
    console.log('  ⓘ dev-login chain skipped (dev-login disabled in this env).');
  } else if (!users[0]?.email) {
    recordFailure('dev-login chain', 'no seed email to log in as');
  } else {
    const firstEmail = users[0].email;
    // Cookie jar via simple in-memory map.
    let cookie = '';
    const loginResp = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: firstEmail }),
      redirect: 'manual',
    });
    const setCookie = loginResp.headers.get('set-cookie') ?? '';
    const m = /Gremium-session=[^;]+/.exec(setCookie);
    cookie = m ? m[0] : '';
    if (![200, 303, 307].includes(loginResp.status) || !cookie) {
      recordFailure('dev-login', `no session cookie in response`, loginResp.status);
    } else {
      recordSuccess('dev-login', loginResp.status, `set ${cookie.slice(0, 40)}…`);
      await check(
        'GET  /api/auth/me (with cookie)',
        fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } }),
        [200],
        (b) => {
          const u = (b as { user?: { email?: string } })?.user;
          if (!u?.email) return 'user not in body';
          if (u.email !== firstEmail) return `mismatched email: ${u.email}`;
          return null;
        },
      );
    }
  }

  await check('GET  /api/fx', fetch(`${BASE}/api/fx`), [200]);

  // Summary
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  console.log(`\n  ${'─'.repeat(48)}`);
  console.log(`  ${passed}/${steps.length} OK${failed ? ` · ${failed} failed` : ''}\n`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('e2e:demo crashed:', e);
  process.exit(1);
});
