/* ManilaMC Store settings. Replace placeholders with your real details before launch. */
window.STORE_CONFIG = {
  serverName: "ManilaMC",
  currency: "PHP",
  locale: "en-PH",
  supportUrl: "",
  /* Keep payment account details private until you are ready to publish them. */
  payment: {
    gcash: { enabled: false, displayName: "GCash", instructions: "GCash instructions will appear here after configuration." },
    maya: { enabled: false, displayName: "Maya", instructions: "Maya instructions will appear here after configuration." }
  },
  /* Set this only after deploying a secure backend. Never put secret API keys here. */
  apiBaseUrl: "",
  products: [
    { id: "rank-vip", name: "VIP Rank", category: "Ranks", price: 149, description: "A starter upgrade with exclusive server perks.", icon: "✦", tag: "POPULAR", enabled: true },
    { id: "rank-elite", name: "Elite Rank", category: "Ranks", price: 299, description: "More perks for players ready to stand out.", icon: "⬡", tag: "", enabled: true },
    { id: "rank-legend", name: "Legend Rank", category: "Ranks", price: 499, description: "A premium rank for dedicated members.", icon: "♛", tag: "BEST VALUE", enabled: true },
    { id: "key-basic", name: "Basic Crate Key", category: "Keys", price: 25, description: "Open a crate and try your luck at rewards.", icon: "⚿", tag: "", enabled: true },
    { id: "key-rare", name: "Rare Crate Key", category: "Keys", price: 59, description: "A key for a higher-tier crate.", icon: "⚿", tag: "", enabled: true },
    { id: "item-coins", name: "Coin Bundle", category: "Items", price: 99, description: "An in-game currency bundle.", icon: "◈", tag: "", enabled: true }
  ]
};