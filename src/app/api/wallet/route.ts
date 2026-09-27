import { NextResponse } from 'next/server';
import { createDemoWallet, getBalances } from '@/lib/stellar';
import { insertWallet, getWallet } from '@/lib/db';
import crypto from 'crypto';

// POST /api/wallet — crea wallet demo testnet fondeada con USDC de prueba
export async function POST(req: Request) {
  try {
    const { alias } = await req.json().catch(() => ({}));
    const kp = await createDemoWallet('1000');
    const id = crypto.randomUUID();
    insertWallet(id, kp.publicKey(), kp.secret(), alias);
    return NextResponse.json({ id, public_key: kp.publicKey(), alias });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/wallet?id= — balance real desde Horizon
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  const w = getWallet(id);
  if (!w) return NextResponse.json({ error: 'wallet no encontrada' }, { status: 404 });
  try {
    const balances = await getBalances(w.public_key);
    return NextResponse.json({ id: w.id, public_key: w.public_key, alias: w.alias, balances });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
