# ManilaMC Store API

Node.js 20+ / Express / PostgreSQL backend. It creates orders using server-side prices, starts PayMongo Hosted Checkout for GCash or Maya, accepts manual transaction references, verifies PayMongo webhooks, provides authenticated staff order review, and delivers rewards through Minecraft RCON.

## Important

The API is not live until deployed with PostgreSQL and the environment variables below. The frontend can remain on GitHub Pages, but GitHub Pages cannot run this backend. Deploy this folder to a Node host (Render, Railway, Fly.io, or a VPS) and use a managed PostgreSQL database.

## Setup

1. Create a PostgreSQL database and execute `schema.sql`.
2. Deploy this folder as a Node service with Node 20+; build command `npm install`, start command `npm start`.
3. Copy `.env.example` into the hosting provider's environment-variable settings. Never commit a real `.env`.
4. Set `FRONTEND_ORIGIN` to the exact published storefront origin.
5. Start with a PayMongo test secret key. Set a public HTTPS URL in PayMongo Dashboard → Developers → Webhooks and subscribe to `checkout_session.payment.paid`. Copy that endpoint's signing secret to `PAYMONGO_WEBHOOK_SECRET`.
6. Test a complete GCash/Maya checkout in PayMongo test mode before switching to live credentials.

PayMongo's hosted checkout uses a backend-created Checkout Session. The backend trusts only a correctly signed `checkout_session.payment.paid` webhook, not the browser's success redirect. Official docs: https://docs.paymongo.com/docs/payment-channels-hosted-checkout and https://docs.paymongo.com/docs/developer-tools-webhook-setup-management.

## Minecraft reward delivery

Enable RCON in the server configuration only if your host supports it. Restrict RCON access to the API host/IP using the host firewall; do not expose the RCON port publicly. Set `RCON_HOST`, `RCON_PORT`, and `RCON_PASSWORD` as backend secrets. Configure `GCASH_RECEIVER_NAME`, `GCASH_RECEIVER_NUMBER`, `MAYA_RECEIVER_NAME`, and `MAYA_RECEIVER_NUMBER` as environment variables if you want the manual transfer details shown during checkout.

Default rank command:
`lp user {player} parent set {rank}`

Set `KEY_COMMAND_TEMPLATE` to the exact command syntax from the crate-key plugin installed on ManilaMC, for example only if your plugin uses it:
`smpcrate give {player} {key} {quantity}`

Do not assume that example is correct for your server. Test commands manually in console first. The backend does not run rewards until payment is confirmed or a staff member approves a manual order.

## Staff order panel\n\nOpen the deployed `admin.html`, enter the backend HTTPS URL and the `ADMIN_TOKEN` value, then connect. The panel lists orders, allows staff to approve manual payments with submitted references, and retry failed reward deliveries. Do not share the admin token.\n\n## Manual GCash/Maya

Select `manual-gcash` or `manual-maya` when creating an order. The customer submits the transaction reference to `POST /api/orders/:id/manual-reference`. Staff review orders through `GET /admin/orders` and approve with `POST /admin/orders/:id/approve`. Both admin routes require `Authorization: Bearer ADMIN_TOKEN`.

## API

- `GET /health`
- `GET /api/products`
- `POST /api/orders` — { username, items: [{ id, quantity }], paymentMethod: "gcash" | "paymaya" | "manual-gcash" | "manual-maya" }
- `POST /api/orders/:id/manual-reference` — { reference }
- `POST /webhooks/paymongo` — PayMongo webhook
- `GET /admin/orders` — staff only
- `POST /admin/orders/:id/approve` — staff only
- `POST /admin/orders/:id/retry-delivery` — staff only

## Safety and operations

Use HTTPS, strong random admin token, least-privilege database credentials, restricted RCON networking, backups, and log monitoring. Rotate any secret that is exposed. Manual payment approval is a human decision and should be checked against the actual GCash/Maya transaction before approval. Orders are priced from the backend catalog; client-supplied prices are ignored.
