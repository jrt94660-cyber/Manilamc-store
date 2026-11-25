(() => {
  const config = window.STORE_CONFIG || {};
  const products = (config.products || []).filter(p => p.enabled);
  const peso = value => new Intl.NumberFormat(config.locale || "en-PH", { style: "currency", currency: config.currency || "PHP", maximumFractionDigits: 0 }).format(value).replace("PHP", "₱");
  const $ = id => document.getElementById(id);
  const apiBase = String(config.apiBaseUrl || "").replace(/\/$/, "");
  let cart = [];
  let activeCategory = "All";
  let preparedOrder = "";

  $("year").textContent = new Date().getFullYear();
  if (config.supportUrl) $("support-link").href = config.supportUrl;
  else $("support-link").addEventListener("click", e => { e.preventDefault(); alert("ManilaMC support link has not been configured yet."); });

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  function renderProducts() {
    const shown = products.filter(p => activeCategory === "All" || p.category === activeCategory);
    $("product-grid").innerHTML = shown.map(p => `
      <article class="product-card">
        <div class="product-visual visual-${p.category.toLowerCase()}"><span class="product-icon">${p.icon || "✦"}</span>${p.tag ? `<span class="product-tag">${p.tag}</span>` : ""}<span class="visual-code">MANILAMC / ${p.category.toUpperCase()}</span></div>
        <div class="product-info"><div class="product-category">${p.category}</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-buy"><b>${peso(p.price)}</b><button class="add-button" data-add="${p.id}" aria-label="Add ${escapeHtml(p.name)} to cart">+</button></div></div>
      </article>`).join("");
    $("empty-state").hidden = shown.length > 0;
  }
  function total() { return cart.reduce((sum, item) => sum + item.price * item.qty, 0); }
  function renderCart() {
    $("cart-count").textContent = cart.reduce((sum, item) => sum + item.qty, 0);
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

  $("checkout-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!cart.length) return;
    if (!apiBase) { alert("The ManilaMC order system is not connected yet. Please try again after the store backend has been deployed."); return; }
    const submit = $("checkout-form").querySelector('button[type="submit"]');
    submit.disabled = true;
    const username = $("player-name").value.trim();
    const paymentMethod = $("payment-method").value;
    try {
      const response = await fetch(apiBase + "/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, paymentMethod, items: cart.map(i => ({ id: i.id, quantity: i.qty })) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create order.");
      if (data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
      let reference = "";
      if (data.manualPayment) {
        const infoResponse = await fetch(apiBase + "/api/payment-instructions?method=" + encodeURIComponent(paymentMethod));
        const info = await infoResponse.json();
        const receiver = [info.receiverName, info.receiverNumber].filter(Boolean).join(" · ");
        alert("Order " + data.orderId + " created.\\n" + (receiver ? info.method + " payment to: " + receiver + "\\n" : "") + (info.instructions || "Follow the verified ManilaMC payment instructions.") + "\\nAmount: " + peso(data.totalPHP) + "\\nDo not pay if these details are not the official ManilaMC account.");
        reference = prompt("After sending payment, enter the GCash/Maya transaction reference. Leave blank to submit it later.");
        if (reference && reference.trim()) {
          const refResponse = await fetch(apiBase + "/api/orders/" + encodeURIComponent(data.orderId) + "/manual-reference", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: reference.trim() })
          });
          const refData = await refResponse.json();
          if (!refResponse.ok) throw new Error(refData.error || "Could not submit payment reference.");
        }
      }
      preparedOrder = `MANILAMC STORE ORDER\nOrder ID: ${data.orderId}\nMinecraft username: ${username}\nPayment: ${paymentMethod}\nItems:\n${cart.map(i => `- ${i.name} x${i.qty}`).join("\n")}\nTotal: ${peso(data.totalPHP)}\nStatus: PENDING — staff verification required.`;
      $("order-summary-text").textContent = "Order " + data.orderId + " created for " + username + ". Total: " + peso(data.totalPHP) + ". Status: pending payment verification. Keep your order ID.";
      $("checkout-form").hidden = true;
      $("order-result").hidden = false;
    } catch (error) { alert(error.message || "Checkout failed. Please try again."); }
    finally { submit.disabled = false; }
  });
  $("copy-order").addEventListener("click", async () => { try { await navigator.clipboard.writeText(preparedOrder); $("copy-order").textContent = "Copied!"; } catch { const area = document.createElement("textarea"); area.value = preparedOrder; document.body.append(area); area.select(); document.execCommand("copy"); area.remove(); $("copy-order").textContent = "Copied!"; } });
  $("done-order").addEventListener("click", () => { $("checkout-modal").hidden = true; cart = []; renderCart(); });
  renderProducts(); renderCart();
})();
