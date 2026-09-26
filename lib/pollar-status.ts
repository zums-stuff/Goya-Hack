// lib/pollar-status.ts — Estado de las keys de Pollar (compartido server/cliente).
//
// Clasifica cada key en uno de 3 estados:
//   - 'ok'          → valor real del dashboard: empieza con pub_/sec_ y sin "xxxx".
//   - 'placeholder' → marcador local: pk_/sk_ (setup:env) o contiene "xxxx".
//   - 'missing'     → no está en el entorno.
//
// Formato de keys reales (dashboard.pollar.xyz → Build → API Keys), verificado
// contra ARCHITECTURE §5.2: pub_testnet_users_… / sec_testnet_users_… /
// sec_testnet_ops_….

export type PollarKeyStatus = 'ok' | 'placeholder' | 'missing';

export type PollarSetupStatus = {
  usersPub: PollarKeyStatus; // NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY (app Usuarios)
  usersSec: PollarKeyStatus; // POLLAR_USERS_SECRET_KEY (app Usuarios)
  opsSec: PollarKeyStatus; // POLLAR_OPS_SECRET_KEY (app Operacional)
  needsSetup: boolean; // true si alguna no está 'ok'
};

function classify(v: string | undefined, prefix: 'pub' | 'sec'): PollarKeyStatus {
  if (!v || v.trim() === '') return 'missing';
  if (v.startsWith(`${prefix}_`) && !/xxxx/i.test(v)) return 'ok';
  return 'placeholder';
}

/** Lee process.env y devuelve el estado de las 3 keys de Pollar. */
export function computePollarSetupStatus(env: NodeJS.ProcessEnv): PollarSetupStatus {
  const usersPub = classify(env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY, 'pub');
  const usersSec = classify(env.POLLAR_USERS_SECRET_KEY, 'sec');
  const opsSec = classify(env.POLLAR_OPS_SECRET_KEY, 'sec');
  return {
    usersPub,
    usersSec,
    opsSec,
    needsSetup: usersPub !== 'ok' || usersSec !== 'ok' || opsSec !== 'ok',
  };
}