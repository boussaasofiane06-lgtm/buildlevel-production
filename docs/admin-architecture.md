# Build Level admin architecture

## Separation model

Build Level now treats the customer website, admin dashboard, and backend API as separate deployment surfaces:

- Customer website: premium public storefront only. It should consume read-only `/api/*` endpoints and never import admin code.
- Admin dashboard: `apps/admin`, a separate Vite/React bundle intended for an admin-only Cloudflare Pages project or `admin.buildlevel.com`.
- Backend API: the existing Express/Railway service. Customer endpoints live under `/api/*`; protected management endpoints live under `/api/admin/*`.

## Customer protection rules

Public API responses use explicit field projections. Customers do not receive integration IDs, file URLs, Stripe price links, hidden/delisted state, commissions, or environment data.

Admin-only systems are protected by `requireAdmin` and must stay under `/api/admin/*`.

## Admin dashboard capabilities

The admin app includes sections for:

- Shopify and Printify integration status and sync controls
- Stripe and Tidio AI status
- Product, inventory, order, customer, analytics, content, settings, theme, notification, automation, and environment management surfaces

The admin dashboard stores the returned JWT for API calls and sends it as a Bearer token. This keeps admin functionality out of the public customer bundle.

## Deployment targets

- Railway: deploy the root backend package.
- Cloudflare Pages admin app:
  - root directory: `apps/admin`
  - build command: `pnpm build`
  - output directory: `dist`
  - environment variable: `VITE_API_BASE_URL=https://your-api-host`
- GitHub: source control and PR workflow.

## Secret handling

The admin API reports whether required environment variables exist, but it never returns secret values. Real Shopify, Printify, Stripe, PayPal, and Tidio API calls should be implemented server-side behind `/api/admin/*`.
