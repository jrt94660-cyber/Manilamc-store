(() => {
  const $ = id => document.getElementById(id);
  let base = "", token = "";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  async function api(path, options={}) {
    const r = await fetch(base + path, { ...options, headers: { ...(options.headers || {}), Authorization: "Bearer " + token, "Content-Type": "application/json" } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function load() {
    $("orders").textContent = "Loading…";
    try {
      const orders = await api("/admin/orders");
      if (!orders.length) { $("orders").textContent = "No orders yet."; return; }
      $("orders").innerHTML = `<table class="admin-table"><thead><tr><th>Order</th><th>Player</th><th>Items</th><th>Total</th><th>Payment</th><th>Delivery</th><th>Actions</th></tr></thead><tbody>${orders.map(o => `<tr><td><b>${esc(o.id)}</b><br><span class="admin-muted">${new Date(o.created_at).toLocaleString()}</span></td><td>${esc(o.username)}</td><td>${(o.items || []).map(i => esc(i.name) + " ×" + esc(i.quantity)).join("<br>")}</td><td>₱${esc(o.total_php)}</td><td>${esc(o.payment_method)}<br><span class="admin-status">${esc(o.payment_status)}</span><br><span class="admin-muted">Ref: ${esc(o.payment_reference || "not submitted")}</span></td><td><span class="admin-status">${esc(o.delivery_status)}</span>${o.delivery_error ? '<br><span class="admin-error">' + esc(o.delivery_error) + '</span>' : ""}</td><td><div class="admin-actions">${o.payment_status === "pending" && o.payment_method.startsWith("Manual ") && o.payment_reference ? '<button class="admin-button" data-approve="' + esc(o.id) + '">Approve payment</button>' : ""}${o.payment_status === "paid" && o.delivery_status !== "delivered" ? '<button class="admin-button" data-retry="' + esc(o.id) + '">Retry delivery</button>' : ""}</div></td></tr>`).join("")}</tbody></table>`;
    } catch (e) { $("orders").innerHTML = '<span class="admin-error">' + esc(e.message) + '</span>'; }
  }
  $("connect").addEventListener("click", async () => {
    base = $("api-url").value.trim().replace(/\/$/, "");
    token = $("admin-token").value;
    try { await api("/health"); sessionStorage.setItem("mm_admin_base", base); sessionStorage.setItem("mm_admin_token", token); $("message").textContent = "Connected."; $("message").className = "admin-ok"; await load(); }
    catch (e) { $("message").textContent = e.message; $("message").className = "admin-error"; }
  });
  $("refresh").addEventListener("click", load);
  $("orders").addEventListener("click", async e => {
    const approve = e.target.closest("[data-approve]");
    const retry = e.target.closest("[data-retry]");
    try {
      if (approve) { if (!confirm("Verify that the money has arrived in the official ManilaMC account before approving this order. Continue?")) return; await api("/admin/orders/" + encodeURIComponent(approve.dataset.approve) + "/approve", { method: "POST", body: "{}" }); }
      if (retry) { if (!confirm("Retry the configured Minecraft reward commands? Check the server first to avoid duplicate delivery.")) return; await api("/admin/orders/" + encodeURIComponent(retry.dataset.retry) + "/retry-delivery", { method: "POST", body: "{}" }); }
      await load();
    } catch (e) { alert(e.message); await load(); }
  });
  const savedBase = sessionStorage.getItem("mm_admin_base");
  const savedToken = sessionStorage.getItem("mm_admin_token");
  if (savedBase && savedToken) { $("api-url").value = savedBase; $("admin-token").value = savedToken; }
})();