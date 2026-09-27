import { NextResponse } from 'next/server';
import { createCobro, listCobros, getCobro, getWallet } from '@/lib/db';

// POST /api/cobros { wallet_id, amount, concepto } — quien cobra crea el QR
export async function POST(req: Request) {
  try {
    const { wallet_id, amount, concepto } = await req.json();
    if (!wallet_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'wallet_id y amount>0 requeridos' }, { status: 400 });
    }
    const w = getWallet(wallet_id);
    if (!w) return NextResponse.json({ error: 'wallet no encontrada' }, { status: 404 });
    const cobro = createCobro(wallet_id, Number(amount), concepto);
    return NextResponse.json({ cobro, pay_url: `/goyahack/pay/${cobro.id}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/cobros?wallet= | ?id= — listado o status de un cobro
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const c = getCobro(id);
    if (!c) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
    return NextResponse.json({ cobro: c });
  }
  return NextResponse.json({ cobros: listCobros(url.searchParams.get('wallet') || undefined) });
}
