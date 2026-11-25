# ManilaMC Store

A responsive, Minecraft-themed storefront for ManilaMC. The frontend is static and can be hosted with GitHub Pages.

## Current status

This repository contains the initial storefront: product catalog, category filters, shopping cart, PHP pricing, and a checkout-request preview. **It is not yet a live payment or automatic delivery system.** The checkout currently prepares an order summary in the player's browser; it does not accept or verify payment, upload proof, store orders centrally, or execute Minecraft commands.

## Repository files

- `index.html` — storefront markup
- `styles.css` — responsive dark/blue theme
- `app.js` — catalog rendering, cart and demo order summary
- `config.js` — editable server name, support URL, payment display settings and products

## Customize the store

Edit `config.js`:

1. Set product names, categories, prices (PHP), descriptions and enabled flags.
2. Set the real support URL.
3. Configure GCash/Maya instructions only when you are ready to publish them.
4. Do not place private keys, payment gateway secrets, database credentials, or RCON credentials in this file. It is public client-side code.

## Enable GitHub Pages

In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save. GitHub will provide the public site URL after deployment.

## Required before accepting real orders

A production checkout needs a separate backend and database. Recommended flow:

1. The browser sends the cart and Minecraft username to the backend.
2. The backend recalculates prices from its trusted catalog and creates a pending order.
3. For manual GCash/Maya payments, the player submits a transaction reference and proof through a backend upload endpoint. Staff verify it in an authenticated admin panel.
4. For automatic payments, use a supported payment provider and verify signed webhooks on the server. Never trust a success redirect from the browser.
5. After confirmed payment, a server-side worker delivers the configured reward through a secured Minecraft integration (for example, a plugin/API endpoint or carefully restricted console bridge).
6. Record order status, webhook event IDs and delivery results to prevent duplicate delivery.

The backend should include rate limiting, input validation, admin authentication, audit logs, idempotent payment handling, secure file storage, and secrets stored only in environment variables.

## Payment credentials

No real GCash/Maya account details or gateway credentials are included. Do not share passwords, OTPs, API secrets, or private account credentials in GitHub files or chat.

## License

Add a license if you intend to distribute or reuse this project publicly.
