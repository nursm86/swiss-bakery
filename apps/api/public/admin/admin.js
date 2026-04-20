// Minimal admin SPA - no framework, vanilla JS.
const state = {
  accessToken: null,
  accessExpiresAt: 0,
  products: [],
  heroes: [],
  notice: null,
  settings: {},
};

const api = async (path, { method = "GET", body, form } = {}) => {
  const headers = { Accept: "application/json" };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  let payload = undefined;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res = await fetch(path, {
    method,
    headers,
    body: payload,
    credentials: "include",
  });
  if (res.status === 401 && path !== "/api/auth/refresh" && path !== "/api/auth/login") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${state.accessToken}`;
      res = await fetch(path, {
        method,
        headers,
        body: payload,
        credentials: "include",
      });
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

const tryRefresh = async () => {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    state.accessToken = data.accessToken;
    state.accessExpiresAt = Date.now() + 13 * 60 * 1000;
    return true;
  } catch {
    return false;
  }
};

export const login = async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const errEl = document.getElementById("error");
  errEl.hidden = true;
  try {
    const fd = new FormData(form);
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { email: fd.get("email"), password: fd.get("password") },
    });
    state.accessToken = data.accessToken;
    state.accessExpiresAt = Date.now() + 13 * 60 * 1000;
    sessionStorage.setItem(
      "sb_access",
      JSON.stringify({ t: state.accessToken, e: state.accessExpiresAt }),
    );
    window.location.assign("/admin/dashboard");
  } catch (e) {
    errEl.textContent = e.message || "Sign in failed";
    errEl.hidden = false;
  }
};

const restoreToken = () => {
  try {
    const raw = sessionStorage.getItem("sb_access");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.e > Date.now() + 5000) {
      state.accessToken = parsed.t;
      state.accessExpiresAt = parsed.e;
      return true;
    }
  } catch {}
  return false;
};

export const boot = async () => {
  if (!restoreToken()) {
    const ok = await tryRefresh();
    if (!ok) {
      window.location.assign("/admin/login");
      return;
    }
    sessionStorage.setItem(
      "sb_access",
      JSON.stringify({ t: state.accessToken, e: state.accessExpiresAt }),
    );
  }
  wireTabs();
  wireTopbar();
  wireProducts();
  wireHero();
  wireNotice();
  wireSettings();
  await Promise.all([loadProducts(), loadHero(), loadNotice(), loadSettings()]);
};

const wireTabs = () => {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const id = `tab-${btn.dataset.tab}`;
      document.getElementById(id)?.classList.add("active");
    });
  });
};

const wireTopbar = () => {
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    sessionStorage.removeItem("sb_access");
    window.location.assign("/admin/login");
  });
};

/* ---------- Products ---------- */
const loadProducts = async () => {
  const data = await api("/api/products?all=1");
  state.products = data.products;
  renderProducts();
};

const renderProducts = () => {
  const root = document.getElementById("products-list");
  root.innerHTML = "";
  const grouped = {};
  for (const p of state.products) {
    grouped[p.category] ||= [];
    grouped[p.category].push(p);
  }
  const order = ["Savoury", "Bakery", "Sweets", "Beverages"];
  for (const cat of order) {
    const items = grouped[cat];
    if (!items || items.length === 0) continue;
    const header = document.createElement("h3");
    header.textContent = cat;
    header.style.gridColumn = "1 / -1";
    header.style.fontFamily = "Playfair Display, serif";
    header.style.color = "var(--navy)";
    header.style.margin = "1.25rem 0 0.25rem";
    root.appendChild(header);
    for (const p of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
      root.appendChild(productCard(p));
    }
  }
};

const productCard = (p) => {
  const el = document.createElement("article");
  el.className = "product-card";
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  if (p.imagePath) thumb.style.backgroundImage = `url(${p.imagePath})`;
  else thumb.textContent = "⚜";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = p.name;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span>${p.priceCents == null ? "Visit shop" : `$${(p.priceCents / 100).toFixed(2)} / ${p.unit}`}</span><span>${p.isFeatured ? `<span class="badge featured">Featured</span>` : ""} ${p.isActive ? "" : `<span class="badge inactive">Hidden</span>`}</span>`;
  el.append(thumb, title, meta);
  el.addEventListener("click", () => openProductDialog(p));
  return el;
};

const wireProducts = () => {
  document.getElementById("new-product-btn")?.addEventListener("click", () => openProductDialog(null));
  const dlg = document.getElementById("product-dialog");
  dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
  document.getElementById("product-form").addEventListener("submit", onProductSubmit);
  document.getElementById("product-delete").addEventListener("click", onProductDelete);
};

const openProductDialog = (p) => {
  const dlg = document.getElementById("product-dialog");
  const form = document.getElementById("product-form");
  form.reset();
  document.getElementById("product-dialog-title").textContent = p ? `Edit · ${p.name}` : "New product";
  const del = document.getElementById("product-delete");
  del.hidden = !p;
  if (p) {
    form.id.value = p.id;
    form.name.value = p.name;
    form.slug.value = p.slug;
    form.category.value = p.category;
    form.unit.value = p.unit;
    form.priceAud.value = p.priceCents == null ? "" : (p.priceCents / 100).toFixed(2);
    form.description.value = p.description ?? "";
    form.imagePath.value = p.imagePath ?? "";
    form.isFeatured.checked = !!p.isFeatured;
    form.isActive.checked = !!p.isActive;
    form.sortOrder.value = p.sortOrder ?? 0;
  } else {
    form.isActive.checked = true;
  }
  dlg.showModal();
};

const onProductSubmit = async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const id = form.id.value;
  const file = form.imageFile.files[0];
  let imagePath = form.imagePath.value.trim() || null;
  try {
    if (file) imagePath = await uploadImage(file);
    const priceStr = form.priceAud.value.trim();
    const body = {
      slug: form.slug.value.trim(),
      name: form.name.value.trim(),
      category: form.category.value,
      unit: form.unit.value,
      priceCents: priceStr === "" ? null : Math.round(parseFloat(priceStr) * 100),
      description: form.description.value.trim() || null,
      imagePath,
      isFeatured: form.isFeatured.checked,
      isActive: form.isActive.checked,
      sortOrder: Number(form.sortOrder.value) || 0,
    };
    if (id) {
      await api(`/api/products/${id}`, { method: "PATCH", body });
    } else {
      await api("/api/products", { method: "POST", body });
    }
    document.getElementById("product-dialog").close();
    await loadProducts();
  } catch (e) {
    alert(e.message || "Save failed");
  }
};

const onProductDelete = async () => {
  const form = document.getElementById("product-form");
  const id = form.id.value;
  if (!id) return;
  if (!confirm(`Delete "${form.name.value}"? This cannot be undone.`)) return;
  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
    document.getElementById("product-dialog").close();
    await loadProducts();
  } catch (e) {
    alert(e.message || "Delete failed");
  }
};

/* ---------- Hero ---------- */
const loadHero = async () => {
  const data = await api("/api/hero/all");
  state.heroes = data.banners;
  renderHero();
};

const renderHero = () => {
  const root = document.getElementById("hero-list");
  root.innerHTML = "";
  if (state.heroes.length === 0) {
    root.innerHTML = `<p class="hint">No banners yet. Create one.</p>`;
    return;
  }
  for (const b of state.heroes) {
    const el = document.createElement("article");
    el.className = "hero-card";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (b.imagePath) thumb.style.backgroundImage = `url(${b.imagePath})`;
    else thumb.textContent = "Hero placeholder";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = b.heading;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span>${b.subheading ?? ""}</span><span>${b.isActive ? "" : `<span class="badge inactive">Hidden</span>`}</span>`;
    el.append(thumb, title, meta);
    el.addEventListener("click", () => openHeroDialog(b));
    root.appendChild(el);
  }
};

const wireHero = () => {
  document.getElementById("new-hero-btn")?.addEventListener("click", () => openHeroDialog(null));
  const dlg = document.getElementById("hero-dialog");
  dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
  document.getElementById("hero-form").addEventListener("submit", onHeroSubmit);
  document.getElementById("hero-delete").addEventListener("click", onHeroDelete);
};

const openHeroDialog = (b) => {
  const dlg = document.getElementById("hero-dialog");
  const form = document.getElementById("hero-form");
  form.reset();
  document.getElementById("hero-dialog-title").textContent = b ? `Edit banner` : "New banner";
  document.getElementById("hero-delete").hidden = !b;
  if (b) {
    form.id.value = b.id;
    form.heading.value = b.heading;
    form.subheading.value = b.subheading ?? "";
    form.ctaLabel.value = b.ctaLabel ?? "";
    form.ctaHref.value = b.ctaHref ?? "";
    form.imagePath.value = b.imagePath ?? "";
    form.isActive.checked = !!b.isActive;
    form.sortOrder.value = b.sortOrder ?? 0;
  } else {
    form.isActive.checked = true;
  }
  dlg.showModal();
};

const onHeroSubmit = async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const id = form.id.value;
  const file = form.imageFile.files[0];
  let imagePath = form.imagePath.value.trim() || null;
  try {
    if (file) imagePath = await uploadImage(file);
    const body = {
      heading: form.heading.value.trim(),
      subheading: form.subheading.value.trim() || null,
      ctaLabel: form.ctaLabel.value.trim() || null,
      ctaHref: form.ctaHref.value.trim() || null,
      imagePath,
      isActive: form.isActive.checked,
      sortOrder: Number(form.sortOrder.value) || 0,
    };
    if (id) {
      await api(`/api/hero/${id}`, { method: "PATCH", body });
    } else {
      await api("/api/hero", { method: "POST", body });
    }
    document.getElementById("hero-dialog").close();
    await loadHero();
  } catch (e) {
    alert(e.message || "Save failed");
  }
};

const onHeroDelete = async () => {
  const form = document.getElementById("hero-form");
  const id = form.id.value;
  if (!id) return;
  if (!confirm("Delete this banner?")) return;
  try {
    await api(`/api/hero/${id}`, { method: "DELETE" });
    document.getElementById("hero-dialog").close();
    await loadHero();
  } catch (e) {
    alert(e.message || "Delete failed");
  }
};

/* ---------- Notice ---------- */
const loadNotice = async () => {
  const data = await api("/api/notice/all");
  state.notice = data.notice;
  const form = document.getElementById("notice-form");
  if (state.notice) {
    form.message.value = state.notice.message;
    form.level.value = state.notice.level;
    form.isActive.checked = !!state.notice.isActive;
    form.startsAt.value = state.notice.startsAt ? toLocalInput(state.notice.startsAt) : "";
    form.endsAt.value = state.notice.endsAt ? toLocalInput(state.notice.endsAt) : "";
  }
};

const toLocalInput = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const wireNotice = () => {
  document.getElementById("notice-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const status = document.getElementById("notice-status");
    try {
      const body = {
        message: form.message.value.trim(),
        level: form.level.value,
        isActive: form.isActive.checked,
        startsAt: form.startsAt.value ? new Date(form.startsAt.value).toISOString() : null,
        endsAt: form.endsAt.value ? new Date(form.endsAt.value).toISOString() : null,
      };
      await api("/api/notice", { method: "PATCH", body });
      status.textContent = "Saved ✓";
      setTimeout(() => (status.textContent = ""), 2000);
    } catch (e) {
      status.textContent = e.message || "Save failed";
    }
  });
};

/* ---------- Settings ---------- */
const SETTING_KEYS = [
  "address",
  "phone",
  "email",
  "hours",
  "mapEmbedUrl",
  "facebookUrl",
  "instagramUrl",
  "aboutText",
  "gloriaFoodScriptSrc",
];

const loadSettings = async () => {
  const data = await api("/api/settings");
  state.settings = data.settings;
  const form = document.getElementById("settings-form");
  for (const key of SETTING_KEYS) {
    if (form[key]) form[key].value = state.settings[key] ?? "";
  }
};

const wireSettings = () => {
  document.getElementById("settings-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const status = document.getElementById("settings-status");
    try {
      const items = SETTING_KEYS.map((key) => ({
        key,
        value: (form[key]?.value ?? "").trim(),
      }));
      await api("/api/settings", { method: "PATCH", body: items });
      status.textContent = "Saved ✓";
      setTimeout(() => (status.textContent = ""), 2000);
    } catch (e) {
      status.textContent = e.message || "Save failed";
    }
  });
};

/* ---------- Uploads ---------- */
const uploadImage = async (file) => {
  const fd = new FormData();
  fd.append("image", file);
  const data = await api("/api/uploads", { method: "POST", form: fd });
  return data.imagePath;
};
