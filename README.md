# ManilaMC Store

Minecraft-inspired PHP storefront for ManilaMC. The frontend is static; the secure backend lives in `server/`.

## Products
Ranks: Lime ₱45, Mango ₱75, Coconut ₱100, Wave ₱125, Cherry ₱150, Berry ₱200. Booster is intentionally not sold.
Keys: Keyall ₱15, Palm ₱20, Coral ₱25, Shell ₱30, Tropical ₱35.

The rank descriptions and listed perks are transcribed from the supplied `ranks.yml`. Prices are server-side in `server/src/catalog.js`; update both that catalog and `config.js` together when prices change.

## Deploy
1. Enable GitHub Pages: Settings → Pages → Deploy from branch → main → /(root).
2. Deploy `server/` to a Node.js 20+ hosting service and attach PostgreSQL. Follow `server/README.md`.
3. Run `server/schema.sql` against the database.
4. Configure backend environment variables from `server/.env.example`. Keep secrets in the host's secret manager.
5. Set `apiBaseUrl` in `config.js` to the deployed HTTPS API URL. The public staff interface is `admin.html`; it requires the private `ADMIN_TOKEN`.
6. Configure PayMongo test keys and webhook, then test before enabling live mode. Set `PAYMONGO_SUCCESS_URL` to the deployed `payment-success.html` and `PAYMONGO_CANCEL_URL` to `payment-cancelled.html`.
7. Configure restricted RCON and verify the actual crate plugin command before enabling automatic delivery. Add manual GCash/Maya receiver details as backend environment variables if using manual transfers.

## Security
Never put PayMongo secret keys, webhook secrets, admin tokens, database credentials, or RCON passwords in frontend files or GitHub. Never approve a manual payment until it is confirmed in the merchant's actual GCash/Maya account. GitHub Pages alone cannot host the backend or process payments.
