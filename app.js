(() => {
  const config = window.STORE_CONFIG || {};
  const products = (config.products || []).filter(p => p.enabled);
  const peso = value => new Intl.NumberFormat(config.locale || "en-PH", { style: "currency", currency: config.currency || "PHP", maximumFractionDigits: 0 }).format(value).replace("PHP", "₱");
  const $ = id => document.getElementById(id);
  let cart = [];
  let activeCategory = "All";
  let preparedOrder = "";

  $("year").textContent = new Date().getFullYear();
  if (config.supportUrl) $("support-link").href = config.supportUrl;
  else $("support-link").addEventListener("click", e => { e.preventDefault(); alert("ManilaMC support link has not been configured yet."); });

  function renderProducts() {
    const shown = products.filter(p => activeCategory === "All" || p.category === activeCategory);
    $("product-grid").innerHTML = shown.map(p => `
      <article class="product-card">
        <div class="product-visual visual-${p.category.toLowerCase()}"><span class="product-icon">${p.icon || "✦"}</span>${p.tag ? `<span class="product-tag">${p.tag}</span>` : ""}<span class="visual-code">MANILAMC / ${p.category.toUpperCase()}</span></div>
        <div class="product-info"><div class="product-category">${p.category}</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-buy"><b>${peso(p.price)}</b><button class="add-button" data-add="${p.id}" aria-label="Add ${escapeHtml(p.name)} to cart">+</button></div></div>
      </article>`).join("");
    $("empty-state").hidden = shown.length > 0;
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  function total() { return cart.reduce((sum, item) => sum + item.price * item.qty, 0); }
  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    $("cart-count").textContent = count;
    $("cart-total").textContent = peso(total());
    $("checkout-total").textContent = peso(total());
    $("cart-items").innerHTML = cart.length ? cart.map(item => `<div class="cart-line"><div class="mini-icon">${item.icon || "✦"}</div><div class="cart-line-info"><b>${escapeHtml(item.name)}</b><span>${peso(item.price)} each</span><div class="quantity"><button data-qty="${item.id}" data-change="-1">−</button><span>${item.qty}</span><button data-qty="${item.id}" data-change="1">+</button></div></div><b>${peso(item.price * item.qty)}</b></div>`).join("") : '<div class="cart-empty"><span>＋</span><h3>Your cart is empty</h3><p>Add something from the store to get started.</p></div>';
    $("checkout-button").disabled = !cart.length;
  }
  function openCart() { $("overlay").hidden = false; $("cart-drawer").classList.add("open"); $("cart-drawer").setAttribute("aria-hidden", "false"); }
  function closeCart() { $("overlay").hidden = true; $("cart-drawer").classList.remove("open"); $("cart-drawer").setAttribute("aria-hidden", "true"); }
  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { const p = products.find(x => x.id === add.dataset.add); if (p) { const existing = cart.find(x => x.id === p.id); existing ? existing.qty++ : cart.push({ ...p, qty: 1 }); renderCart(); add.classList.add("added"); add.textContent = "✓"; setTimeout(() => { add.classList.remove("added"); add.textContent = "+"; }, 700); } }
    const qty = e.target.closest("[data-qty]");
    if (qty) { const item = cart.find(x => x.id === qty.dataset.qty); if (item) { item.qty += Number(qty.dataset.change); if (item.qty <= 0) cart = cart.filter(x => x.id !== item.id); renderCart(); } }
    const category = e.target.closest("[data-category]");
    if (category) { activeCategory = category.dataset.category; document.querySelectorAll("[data-category]").forEach(b => b.classList.toggle("active", b === category)); renderProducts(); }
  });
  $("open-cart").addEventListener("click", openCart);
  $("close-cart").addEventListener("click", closeCart);
  $("overlay").addEventListener("click", closeCart);
  $("checkout-button").addEventListener("click", () => { closeCart(); $("checkout-modal").hidden = false; $("order-result").hidden = true; $("checkout-form").hidden = false; $("checkout-total").textContent = peso(total()); });
  $("close-checkout").addEventListener("click", () => $("checkout-modal").hidden = true);
  $("checkout-form").addEventListener("submit", e => {
    e.preventDefault();
    if (!cart.length) return;
    const username = $("player-name").value.trim();
    const payment = $("payment-method").value;
    const lines = cart.map(i => `- ${i.name} x${i.qty}: ${peso(i.price * i.qty)}`).join("\n");
    preparedOrder = `MANILAMC STORE ORDER REQUEST\nMinecraft username: ${username}\nPayment method: ${payment}\n\nItems:\n${lines}\n\nTotal: ${peso(total())}\n\nStatus: UNPAID — awaiting staff instructions and payment verification.\nThis is an order request only; no payment has been processed.`;
    $("order-summary-text").textContent = `Order for ${username} · ${payment} · Total ${peso(total())}. Copy the details and send them to ManilaMC staff. Do not send payment until staff provide verified payment instructions.`;
    $("checkout-form").hidden = true;
    $("order-result").hidden = false;
  });
  $("copy-order").addEventListener("click", async () => { try { await navigator.clipboard.writeText(preparedOrder); $("copy-order").textContent = "Copied!"; } catch { const area = document.createElement("textarea"); area.value = preparedOrder; document.body.append(area); area.select(); document.execCommand("copy"); area.remove(); $("copy-order").textContent = "Copied!"; } });
  $("done-order").addEventListener("click", () => { $("checkout-modal").hidden = true; cart = []; renderCart(); });
  renderProducts(); renderCart();
})();