# BUILD LEVEL Backend

Express + TypeScript API for products, blog posts, digital products, affiliate products, memberships, admin auth, and Stripe checkout.

## Requirements

- Node.js 20+
- MySQL database
- Stripe account/API key for checkout routes

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with real values, then create/update the database schema:

```bash
npm run db:push
```

## Admin password hash

`ADMIN_PASSWORD_HASH` must be in `salt:hex_scrypt_hash` format. Generate one with:

```bash
node -e "const {randomBytes,scryptSync}=require('crypto'); const p=process.argv[1]; const s=randomBytes(16).toString('hex'); console.log(`${s}:${scryptSync(p,s,64).toString('hex')}`)" "your-password"
```

## Development

```bash
npm run dev
```

The API listens on `PORT` or `3001` by default.

## Production

```bash
npm run build
npm start
```

Required production variables:

- `DATABASE_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `ADMIN_PASSWORD_HASH`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Verification

```bash
npm run check
```

This runs TypeScript compilation and a moderate-or-higher dependency audit.
