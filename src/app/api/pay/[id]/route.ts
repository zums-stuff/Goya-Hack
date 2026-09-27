import { NextResponse } from 'next/server';
import { getCobro, getWallet, markCobroPaid } from '@/lib/db';
import { payUsdc, explorerTxUrl } from '@/lib/stellar';

type Params = { params: Promise<{ id: string }> };

// GET /api/pay/:id — info pública del cobro (para la página de pago)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const c = getCobro(id);
  if (!c) return NextResponse.json({ error: 'cobro no encontrado' }, { status: 404 });
  const payee = getWallet(c.payee_wallet_id);
  return NextResponse.json({
    cobro: {
      id: c.id, amount: c.amount, asset: c.asset, concepto: c.concepto,
      status: c.status, tx_hash: c.tx_hash, paid_at: c.paid_at,
      payee_alias: payee?.alias || 'Comercio',
      payee_public: payee?.public_key,
    },
    explorer_url: c.tx_hash ? explorerTxUrl(c.tx_hash) : null,
  });
}

// POST /api/pay/:id { payer_wallet_id } — ejecuta el pago USDC real en testnet
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { payer_wallet_id } = await req.json();
    const c = getCobro(id);
    if (!c) return NextResponse.json({ error: 'cobro no encontrado' }, { status: 404 });
    if (c.status === 'paid') {
      return NextResponse.json({ error: 'ya pagado', cobro: c }, { status: 409 });
    }
    const payer = getWallet(payer_wallet_id);
    const payee = getWallet(c.payee_wallet_id);
    if (!payer || !payee) return NextResponse.json({ error: 'wallet inválida' }, { status: 400 });
    if (payer.id === payee.id) return NextResponse.json({ error: 'no puedes pagarte a ti mismo' }, { status: 400 });

    const result = await payUsdc(payer.secret, payee.public_key, String(c.amount), c.id);
    const paid = markCobroPaid(c.id, payer.id, result.hash);
    return NextResponse.json({ cobro: paid, tx_hash: result.hash, explorer_url: explorerTxUrl(result.hash) });
  } catch (e: any) {
    const detail = e?.response?.data?.extras?.result_codes || e.message;
    return NextResponse.json({ error: 'pago falló', detail }, { status: 500 });
  }
}
