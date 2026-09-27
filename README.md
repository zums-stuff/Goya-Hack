# PumaPay — GOYA HACK 2026

Cobros con QR entre dos personas. La blockchain (Stellar) es la plomería invisible;
el usuario solo ve dólares. **Semana DIE × CriptoUNAM × FI-UNAM — 22–25 sep 2026.**

## Estado del build

- [x] Cobro → QR → pago → confirmación on-chain (testnet real, tx verificable)
- [ ] Capa social: tandas / cobros grupales
- [ ] Agente IA en español (intenciones → cobros)
- [ ] Pollar embedded wallets (sponsor tech)
- [ ] Landing de pitch + video demo

## Correr local

```bash
npm install
cp .env.example .env   # generar issuer testnet (ver .env.example)
npm run dev            # http://localhost:3096/goyahack
```

## Flujo de demo

1. `POST /api/wallet` — crea wallet testnet fondeada (XLM friendbot + trustline + 1000 USDC demo)
2. `POST /api/cobros {wallet_id, amount}` — cobro con ref `GH-XXXXXX`
3. QR → `/pay/:id` — pagador crea wallet con un tap y paga USDC real
4. Polling `/api/cobros?id=` → `paid` + `tx_hash` → stellar.expert/testnet

## Notas

- Todo corre en **Stellar Testnet** — USDC de demo emitido por `DEMO_USDC_ISSUER_SECRET`.
- En producción: mismo flujo con USDC de Circle (`GA5ZSEJY…`) y ramps fiat
  (Etherfuse SPEI para MX, MoneyGram cash para EC) — documentado en `docs/`.
