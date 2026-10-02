// Minimal admin SPA - no framework, vanilla JS.
import { groupBySubcategory } from "/js/menu-model.js?v=20261002a";
import { formatPriceLines, parseGstSettings } from "/js/pricing.js?v=20261002a";

const state = {
  accessToken: null,
  accessExpiresAt: 0,
  categories: [],
  products: [],
  heroes: [],
  notice: null,
  settings: {},
};

const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;

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

// Generic helper: disable a form's submit button and show a spinner while
// `asyncFn` runs. Prevents double-submits and gives the user visible feedback.
// Usage:  withBusy(form, "Saving…", async () => { ... });
const withBusy = async (form, label, asyncFn) => {
  const btn = form?.querySelector?.('button[type="submit"]');
  if (!btn) return await asyncFn();
  if (btn.dataset.busy === "1") return; // already in-flight, ignore double-submit
  const original = btn.innerHTML;
  btn.dataset.busy = "1";
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label || "Saving…"}`;
  try {
    return await asyncFn();
  } finally {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    delete btn.dataset.busy;
    btn.innerHTML = original;
  }
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
  await withBusy(form, "Signing in…", async () => {
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
  });
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
  wirePages();
  wireMenu();
  wireCategories();
  await loadCategories(); // products render grouped by these, so load them first
  await Promise.all([loadProducts(), loadHero(), loadNotice(), loadSettings(), loadPages()]);
  loadMenu();
};

const wireTabs = () => {
  document.querySelectorAll("button.tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("button.tab").forEach((b) => b.classList.remove("active"));
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
  renderCategories(); // product counts per category
};

/* ---------- Categories (database, via /api/categories) ---------- */
const loadCategories = async () => {
  const data = await api("/api/categories");
  applyCategories(data.categories);
};

// Every category change returns the fresh list: refresh everything that shows it.
const applyCategories = (categories) => {
  state.categories = categories;
  const select = document.querySelector("#product-form select[name=category]");
  const selected = select.value;
  select.replaceChildren(...state.categories.map((c) => new Option(c.label, c.key)));
  if (selected) select.value = selected;
  renderCategories();
  renderProducts();
};

const findCategory = (key) => state.categories.find((c) => c.key === key);
const categoryLabel = (key) => findCategory(key)?.label ?? key;
const countProductsInSubcategory = (id) => state.products.filter((p) => p.subcategoryId === id).length;

const renderCategories = () => {
  const root = document.getElementById("categories-list");
  if (!root) return;
  const productCounts = new Map();
  for (const p of state.products) productCounts.set(p.category, (productCounts.get(p.category) ?? 0) + 1);
  root.replaceChildren(
    ...state.categories.map((category, index) => categoryCard(category, index, productCounts.get(category.key) ?? 0)),
  );
};

const categoryCard = (category, index, productCount) => {
  const card = document.createElement("article");
  card.className = "cat-card";

  const order = document.createElement("div");
  order.className = "menu-order-btns";
  const up = mkBtn("↑", "ghost small icon", () => moveCategory(index, -1));
  const down = mkBtn("↓", "ghost small icon", () => moveCategory(index, 1));
  up.disabled = index === 0;
  down.disabled = index === state.categories.length - 1;
  up.setAttribute("aria-label", `Move ${category.label} up`);
  down.setAttribute("aria-label", `Move ${category.label} down`);
  order.append(up, down);

  const info = document.createElement("div");
  info.className = "cat-card-info";
  const name = document.createElement("div");
  name.className = "cat-card-name";
  name.textContent = category.label;
  const meta = document.createElement("div");
  meta.className = "cat-card-meta";
  meta.textContent = `${plural(productCount, "product")} · ${plural(category.subcategories.length, "subcategory", "subcategories")}`;
  info.append(name, meta);
  if (category.subcategories.length > 0) {
    const chips = document.createElement("div");
    chips.className = "cat-card-subs";
    for (const subcategory of category.subcategories) {
      const chip = document.createElement("span");
      chip.className = "cat-sub-chip";
      chip.textContent = subcategory.label;
      chips.append(chip);
    }
    info.append(chips);
  }

  const edit = mkBtn("Edit", "ghost", () => openCategoryDialog(category));
  edit.setAttribute("aria-label", `Edit ${category.label}`);
  card.append(order, info, edit);
  return card;
};

const moveCategory = async (index, step) => {
  const keys = state.categories.map((c) => c.key);
  const target = index + step;
  if (target < 0 || target >= keys.length) return;
  [keys[index], keys[target]] = [keys[target], keys[index]];
  try {
    const data = await api("/api/categories/order", { method: "PUT", body: { keys } });
    applyCategories(data.categories);
  } catch (e) {
    alert(e.message || "Couldn't change the order");
  }
};

const wireCategories = () => {
  document.getElementById("new-category-btn")?.addEventListener("click", () => openCategoryDialog(null));
  const dialog = document.getElementById("category-dialog");
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dialog.close()));
  document.getElementById("category-form").addEventListener("submit", onCategorySubmit);
  document.getElementById("category-delete").addEventListener("click", onCategoryDelete);
  document.getElementById("add-subcategory-btn").addEventListener("click", () => {
    const row = subcategoryRow(null);
    document.getElementById("subcategory-rows").append(row);
    row.querySelector("input").focus();
  });
};

// One editable subcategory line in the category dialog. Existing ones carry
// their id, so the API renames them instead of creating new ones.
const subcategoryRow = (subcategory) => {
  const row = document.createElement("li");
  row.className = "sub-row";
  if (subcategory) row.dataset.id = String(subcategory.id);

  const order = document.createElement("div");
  order.className = "menu-order-btns";
  const moveRow = (step) => {
    const neighbour = step < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!neighbour) return;
    if (step < 0) neighbour.before(row);
    else neighbour.after(row);
    row.querySelector("input").focus();
  };
  const up = mkBtn("↑", "ghost small icon", () => moveRow(-1));
  const down = mkBtn("↓", "ghost small icon", () => moveRow(1));
  up.setAttribute("aria-label", "Move up");
  down.setAttribute("aria-label", "Move down");
  order.append(up, down);

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 60;
  input.value = subcategory?.label ?? "";
  input.placeholder = "e.g. Hot drinks";
  input.setAttribute("aria-label", "Subcategory name");

  const count = document.createElement("span");
  count.className = "hint sub-row-count";
  count.textContent = subcategory ? plural(countProductsInSubcategory(subcategory.id), "product") : "new";

  const remove = mkBtn("✕", "ghost small-btn", () => row.remove());
  remove.setAttribute("aria-label", "Remove subcategory");
  remove.title = "Remove";
  row.append(order, input, count, remove);
  return row;
};

const openCategoryDialog = (category) => {
  const form = document.getElementById("category-form");
  resetForm(form);
  document.getElementById("category-dialog-title").textContent = category ? `Edit · ${category.label}` : "New category";
  document.getElementById("category-delete").hidden = !category;
  form.key.value = category?.key ?? "";
  form.label.value = category?.label ?? "";
  form.blurb.value = category?.blurb ?? "";
  form.menuSubtitle.value = category?.menu.subtitle ?? "";
  const columns = String(category?.menu.columns ?? 2);
  for (const radio of form.querySelectorAll("input[name=menuColumns]")) radio.checked = radio.value === columns;
  document.getElementById("subcategory-rows").replaceChildren(...(category?.subcategories ?? []).map(subcategoryRow));
  document.getElementById("category-dialog").showModal();
};

const onCategorySubmit = async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const key = form.key.value;
  const subcategories = [...document.querySelectorAll("#subcategory-rows .sub-row")]
    .map((row) => ({
      ...(row.dataset.id ? { id: Number(row.dataset.id) } : {}),
      label: row.querySelector("input").value.trim(),
    }))
    .filter((s) => s.label !== "");

  // Products in a removed subcategory stay in the category with no subcategory: say so first.
  const keptIds = new Set(subcategories.flatMap((s) => (s.id ? [s.id] : [])));
  const removed = (findCategory(key)?.subcategories ?? []).filter((s) => !keptIds.has(s.id));
  const affected = removed.reduce((sum, s) => sum + countProductsInSubcategory(s.id), 0);
  if (affected > 0) {
    const names = removed.map((s) => `"${s.label}"`).join(", ");
    if (!confirm(`Removing ${names} moves ${plural(affected, "product")} to no subcategory. Continue?`)) return;
  }

  const body = {
    label: form.label.value.trim(),
    blurb: form.blurb.value.trim(),
    menuSubtitle: form.menuSubtitle.value.trim(),
    menuColumns: Number(form.querySelector("input[name=menuColumns]:checked")?.value ?? 2),
    subcategories,
  };
  await withBusy(form, "Saving…", async () => {
    try {
      const data = key
        ? await api(`/api/categories/${encodeURIComponent(key)}`, { method: "PATCH", body })
        : await api("/api/categories", { method: "POST", body });
      document.getElementById("category-dialog").close();
      if (removed.length > 0) await loadProducts(); // their products lost the subcategory
      applyCategories(data.categories);
    } catch (e) {
      alert(e.message || "Save failed");
    }
  });
};

const onCategoryDelete = async () => {
  const category = findCategory(document.getElementById("category-form").key.value);
  if (!category) return;
  if (!confirm(`Delete the category "${category.label}"? This cannot be undone.`)) return;
  try {
    const data = await api(`/api/categories/${encodeURIComponent(category.key)}`, { method: "DELETE" });
    document.getElementById("category-dialog").close();
    applyCategories(data.categories);
  } catch (e) {
    alert(e.message || "Delete failed");
  }
};

const renderProducts = () => {
  const root = document.getElementById("products-list");
  root.innerHTML = "";
  const grouped = {};
  for (const p of state.products) {
    grouped[p.category] ||= [];
    grouped[p.category].push(p);
  }
  // Known categories first, in their configured order. A product whose category
  // was removed from the list still shows (under its old key) so it can be moved.
  const knownKeys = state.categories.map((c) => c.key);
  const orphanKeys = Object.keys(grouped).filter((key) => !knownKeys.includes(key));
  for (const cat of [...knownKeys, ...orphanKeys]) {
    const items = grouped[cat];
    if (!items || items.length === 0) continue;
    const header = document.createElement("h3");
    header.className = "products-cat-head";
    header.textContent = knownKeys.includes(cat) ? categoryLabel(cat) : `${cat} (category no longer exists - move these)`;
    root.appendChild(header);
    const sorted = items.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const group of groupBySubcategory(sorted, findCategory(cat)?.subcategories)) {
      if (group.subcategory) {
        const subHeader = document.createElement("h4");
        subHeader.className = "products-sub-head";
        subHeader.textContent = group.subcategory.label;
        root.appendChild(subHeader);
      }
      for (const p of group.products) root.appendChild(productCard(p));
    }
  }
};

// Format a product's price + unit, accounting for the qty field.
//   qty=1  →  "$26/kg"
//   qty>1  →  "$24/2kg"  or  "$7/5pcs"  (piece is pluralised to "pcs")
const formatProductPrice = (p) => {
  const lines = formatPriceLines(p, parseGstSettings(state.settings));
  return lines.length > 0 ? lines.join(" · ") : "Visit shop";
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
  meta.innerHTML = `<span>${formatProductPrice(p)}</span><span>${p.isFeatured ? `<span class="badge featured">Featured</span>` : ""} ${p.isActive ? "" : `<span class="badge inactive">Hidden</span>`}</span>`;
  el.append(thumb, title, meta);
  el.addEventListener("click", () => openProductDialog(p));
  return el;
};

const wireProducts = () => {
  document.getElementById("new-product-btn")?.addEventListener("click", () => openProductDialog(null));
  const dlg = document.getElementById("product-dialog");
  dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
  const form = document.getElementById("product-form");
  form.addEventListener("submit", onProductSubmit);
  form.category.addEventListener("change", () => fillSubcategorySelect(form.category.value, null));
  document.getElementById("product-delete").addEventListener("click", onProductDelete);
  document.getElementById("products-restore-btn")?.addEventListener("click", onProductsRestore);
};

const onProductsRestore = async () => {
  const btn = document.getElementById("products-restore-btn");
  const status = document.getElementById("products-restore-status");
  if (!btn || btn.dataset.busy === "1") return;
  const ok = confirm(
    "Restore the entire product listing from the seed file?\n\n" +
      "This will:\n" +
      "  • update prices, names and descriptions for all products in the seed\n" +
      "  • create any missing products\n" +
      "  • overwrite manual edits on those products (slugs are the key)\n\n" +
      "Products NOT listed in the seed file are left untouched.",
  );
  if (!ok) return;
  const original = btn.innerHTML;
  btn.dataset.busy = "1";
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>Restoring…`;
  if (status) status.textContent = "";
  try {
    const data = await api("/api/products/restore", { method: "POST" });
    if (status) {
      status.textContent = `Restored ✓  ${data.total} total · ${data.created} new · ${data.updated} updated`;
      setTimeout(() => (status.textContent = ""), 6000);
    }
    await loadProducts();
  } catch (e) {
    if (status) status.textContent = e.message || "Restore failed";
    else alert(e.message || "Restore failed");
  } finally {
    btn.disabled = false;
    delete btn.dataset.busy;
    btn.innerHTML = original;
  }
};

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");

// form.reset() leaves hidden inputs alone (setting .value on a hidden input
// changes its default), so a "New" dialog would keep the last edited record's
// id and save over it. Clear them explicitly.
const resetForm = (form) => {
  form.reset();
  for (const input of form.querySelectorAll("input[type=hidden]")) input.value = "";
};

// The Subcategory select lists the chosen category's subcategories; hidden when it has none.
const fillSubcategorySelect = (categoryKey, selectedId) => {
  const select = document.querySelector("#product-form select[name=subcategoryId]");
  const subcategories = findCategory(categoryKey)?.subcategories ?? [];
  select.replaceChildren(new Option("— None —", ""), ...subcategories.map((s) => new Option(s.label, String(s.id))));
  select.value = subcategories.some((s) => s.id === selectedId) ? String(selectedId) : "";
  document.getElementById("product-subcategory-field").hidden = subcategories.length === 0;
};

const openProductDialog = (p) => {
  const dlg = document.getElementById("product-dialog");
  const form = document.getElementById("product-form");
  resetForm(form);
  document.getElementById("product-dialog-title").textContent = p ? `Edit · ${p.name}` : "New product";
  const del = document.getElementById("product-delete");
  del.hidden = !p;
  if (p) {
    form.id.value = p.id;
    form.name.value = p.name;
    form.slug.value = p.slug;
    form.category.value = p.category;
    form.unit.value = p.unit;
    if (form.qty) form.qty.value = p.qty ?? 1;
    form.priceAud.value = p.priceCents == null ? "" : (p.priceCents / 100).toFixed(2);
    form.description.value = p.description ?? "";
    form.imagePath.value = p.imagePath ?? "";
    form.isFeatured.checked = !!p.isFeatured;
    form.isActive.checked = !!p.isActive;
    form.sortOrder.value = p.sortOrder ?? 0;
  } else {
    form.isActive.checked = true;
    if (form.qty) form.qty.value = 1;
  }
  fillSubcategorySelect(form.category.value, p?.subcategoryId ?? null);

  // Auto-fill slug from name. Stops once user types in the slug field directly.
  let autoSlug = !p; // only auto-fill for new products
  const nameInput = form.name;
  const slugInput = form.slug;
  const onName = () => {
    if (!autoSlug) return;
    slugInput.value = slugify(nameInput.value);
  };
  const onSlug = () => {
    autoSlug = false;
  };
  nameInput.addEventListener("input", onName);
  slugInput.addEventListener("input", onSlug);
  // Detach listeners when dialog closes so they don't stack across opens.
  dlg.addEventListener(
    "close",
    () => {
      nameInput.removeEventListener("input", onName);
      slugInput.removeEventListener("input", onSlug);
    },
    { once: true },
  );

  dlg.showModal();
};

const onProductSubmit = async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  await withBusy(form, "Saving…", async () => {
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
        subcategoryId: form.subcategoryId.value ? Number(form.subcategoryId.value) : null,
        unit: form.unit.value,
        qty: Math.max(1, Math.floor(Number(form.qty?.value) || 1)),
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
  });
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
  resetForm(form);
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
  await withBusy(form, "Saving…", async () => {
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
  });
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
    await withBusy(form, "Saving…", async () => {
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
  "gloriafoodCuid",
  "gloriafoodRuid",
  "shopPhone",
  "gstEnabled",
];

// Shown when a setting has never been saved, matching the site's own defaults.
const SETTING_FORM_DEFAULTS = { gstEnabled: "true" };

const loadSettings = async () => {
  const data = await api("/api/settings");
  state.settings = data.settings;
  const form = document.getElementById("settings-form");
  for (const key of SETTING_KEYS) {
    if (form[key]) form[key].value = state.settings[key] ?? SETTING_FORM_DEFAULTS[key] ?? "";
  }
};

const wireSettings = () => {
  document.getElementById("settings-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const status = document.getElementById("settings-status");
    await withBusy(form, "Saving…", async () => {
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
  });
};

/* ---------- Pages ---------- */
let pagesCache = [];

const loadPages = async () => {
  const data = await api("/api/pages/all");
  pagesCache = data.pages ?? [];
  const sel = document.getElementById("pages-select");
  if (!sel) return;
  sel.innerHTML = "";
  for (const p of pagesCache) {
    const opt = document.createElement("option");
    opt.value = p.slug;
    opt.textContent = `${p.title}  (/${p.slug})`;
    sel.appendChild(opt);
  }
  if (pagesCache.length > 0) {
    sel.value = pagesCache[0].slug;
    fillPageForm(pagesCache[0]);
  }
};

const fillPageForm = (p) => {
  const form = document.getElementById("pages-form");
  form.title.value = p.title;
  form.content.value = p.content;
  form.isPublished.checked = !!p.isPublished;
  form.dataset.slug = p.slug;
};

const wirePages = () => {
  const sel = document.getElementById("pages-select");
  sel?.addEventListener("change", () => {
    const p = pagesCache.find((x) => x.slug === sel.value);
    if (p) fillPageForm(p);
  });
  document.getElementById("pages-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const slug = form.dataset.slug;
    const status = document.getElementById("pages-status");
    await withBusy(form, "Saving page…", async () => {
      try {
        const body = {
          title: form.title.value.trim(),
          content: form.content.value,
          isPublished: form.isPublished.checked,
        };
        const data = await api(`/api/pages/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          body,
        });
        // refresh cache
        const idx = pagesCache.findIndex((x) => x.slug === slug);
        if (idx >= 0) pagesCache[idx] = data.page;
        status.textContent = "Saved ✓";
        setTimeout(() => (status.textContent = ""), 2000);
      } catch (e) {
        status.textContent = e.message || "Save failed";
      }
    });
  });
};

/* ---------- Menu builder ---------- */
const MENU_KEY = "sb_menu_builder_v1";
const MENU_PREVIEW_KEY = "sb_menu_preview_v1";
const UNIT_OPTIONS = [
  { value: "", label: "— inherit —" },
  { value: "piece", label: "piece" },
  { value: "kg", label: "kg" },
  { value: "pack", label: "pack" },
  { value: "cup", label: "cup" },
  { value: "pound", label: "pound" },
  { value: "half-pound", label: "½ pound" },
];
const categoryMenuDefaults = (key) => {
  const category = findCategory(key);
  return { title: category?.menu.title ?? key.toUpperCase(), subtitle: category?.menu.subtitle ?? "", defaultUnit: "" };
};

const defaultMenu = () => ({
  v: 1,
  doc: {
    tagline: "Handcrafted daily · Swiss soul, Bengali heart",
    strapline: "ALL PRICES AUD · DINE-IN & TAKEAWAY",
    footer: "Baked fresh every morning",
    location: "SWISS · BAKERY · MINTO",
    showPhotos: false,
  },
  categories: [],
});

let menuConfig = defaultMenu();
let menuSaveTimer = null;

const loadMenuConfig = () => {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) menuConfig = parsed;
    }
  } catch {}
};

const saveMenuConfig = () => {
  clearTimeout(menuSaveTimer);
  menuSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(MENU_KEY, JSON.stringify(menuConfig));
      const status = document.getElementById("menu-status");
      if (status) {
        status.textContent = "Saved ✓";
        setTimeout(() => (status.textContent = ""), 1500);
      }
    } catch {}
  }, 250);
};

const reconcileMenu = (cfg, products) => {
  const byCat = new Map();
  for (const p of products) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  for (const [, list] of byCat) list.sort((a, b) => a.sortOrder - b.sortOrder);
  const seen = new Set();
  const cats = [];
  for (const c of cfg.categories) {
    if (!byCat.has(c.key)) continue;
    seen.add(c.key);
    const items = byCat.get(c.key);
    const have = new Set(c.products.map((e) => e.id));
    const productEntries = c.products.filter((e) => items.some((p) => p.id === e.id));
    for (const p of items) {
      if (!have.has(p.id)) {
        productEntries.push({
          id: p.id,
          included: p.isActive !== false,
          priceCents: p.priceCents ?? null,
          unitOverride: "",
        });
      }
    }
    cats.push({ ...c, products: productEntries });
  }
  // Categories new to the builder join at the end, in the site's category order.
  const categoryPosition = new Map(state.categories.map((c, i) => [c.key, i]));
  const positionOf = (key) => categoryPosition.get(key) ?? Number.MAX_SAFE_INTEGER;
  const unseenKeys = [...byCat.keys()].filter((key) => !seen.has(key)).sort((a, b) => positionOf(a) - positionOf(b));
  for (const key of unseenKeys) {
    const items = byCat.get(key);
    const def = categoryMenuDefaults(key);
    cats.push({
      key,
      title: def.title,
      subtitle: def.subtitle,
      columns: 2,
      showPhotos: false,
      pageBreakBefore: false,
      defaultUnit: def.defaultUnit,
      collapsed: true,
      products: items.map((p) => ({
        id: p.id,
        included: p.isActive !== false,
        priceCents: p.priceCents ?? null,
        unitOverride: "",
      })),
    });
  }
  for (const c of cats) {
    if (typeof c.collapsed !== "boolean") c.collapsed = true;
  }
  return { ...cfg, categories: cats };
};

const wireMenu = () => {
  document.getElementById("menu-tagline")?.addEventListener("input", (e) => {
    menuConfig.doc.tagline = e.target.value;
    saveMenuConfig();
  });
  document.getElementById("menu-strapline")?.addEventListener("input", (e) => {
    menuConfig.doc.strapline = e.target.value;
    saveMenuConfig();
  });
  document.getElementById("menu-footer")?.addEventListener("input", (e) => {
    menuConfig.doc.footer = e.target.value;
    saveMenuConfig();
  });
  document.getElementById("menu-location")?.addEventListener("input", (e) => {
    menuConfig.doc.location = e.target.value;
    saveMenuConfig();
  });
  document.getElementById("menu-show-photos")?.addEventListener("change", (e) => {
    menuConfig.doc.showPhotos = e.target.checked;
    saveMenuConfig();
  });
  document.getElementById("menu-reset-btn")?.addEventListener("click", () => {
    if (!confirm("Reset menu builder to defaults? Your current customisations will be lost.")) return;
    menuConfig = defaultMenu();
    menuConfig = reconcileMenu(menuConfig, state.products);
    saveMenuConfig();
    renderMenuBuilder();
  });
  document.getElementById("menu-resync-btn")?.addEventListener("click", () => {
    for (const c of menuConfig.categories) {
      const cur = state.products.filter((p) => p.category === c.key);
      const map = new Map(cur.map((p) => [p.id, p]));
      for (const e of c.products) {
        const p = map.get(e.id);
        if (p) e.priceCents = p.priceCents ?? null;
      }
    }
    saveMenuConfig();
    renderMenuBuilder();
    const status = document.getElementById("menu-status");
    if (status) {
      status.textContent = "Prices resynced ✓";
      setTimeout(() => (status.textContent = ""), 1800);
    }
  });
  document.getElementById("menu-clear-breaks-btn")?.addEventListener("click", () => {
    const set = menuConfig.categories.filter((c) => c.pageBreakBefore).length;
    if (set === 0) {
      const status = document.getElementById("menu-status");
      if (status) {
        status.textContent = "No page breaks were set.";
        setTimeout(() => (status.textContent = ""), 1800);
      }
      return;
    }
    if (!confirm(`Clear ${set} page break(s)? Categories will flow naturally onto the next page only when they run out of room.`)) return;
    for (const c of menuConfig.categories) c.pageBreakBefore = false;
    saveMenuConfig();
    renderMenuBuilder();
    const status = document.getElementById("menu-status");
    if (status) {
      status.textContent = `Cleared ${set} page break(s) ✓`;
      setTimeout(() => (status.textContent = ""), 2200);
    }
  });
  document.getElementById("menu-preview-btn")?.addEventListener("click", openMenuPreview);
  document.getElementById("menu-toggle-all-btn")?.addEventListener("click", () => {
    const anyCollapsed = menuConfig.categories.some((c) => c.collapsed);
    for (const c of menuConfig.categories) c.collapsed = !anyCollapsed;
    saveMenuConfig();
    renderMenuBuilder();
  });
};

const loadMenu = () => {
  try {
    if (!document.getElementById("menu-categories")) return; // Menu builder section not in DOM (stale dashboard.html); bail silently.
    loadMenuConfig();
    menuConfig = reconcileMenu(menuConfig, state.products);
    saveMenuConfig();
    const d = menuConfig.doc;
    const set = (id, prop, val) => {
      const el = document.getElementById(id);
      if (el) el[prop] = val;
    };
    set("menu-tagline", "value", d.tagline ?? "");
    set("menu-strapline", "value", d.strapline ?? "");
    set("menu-footer", "value", d.footer ?? "");
    set("menu-location", "value", d.location ?? "");
    set("menu-show-photos", "checked", !!d.showPhotos);
    renderMenuBuilder();
  } catch (e) {
    console.error("Menu builder failed to initialise:", e);
  }
};

const renderMenuBuilder = () => {
  const root = document.getElementById("menu-categories");
  if (!root) return;
  root.innerHTML = "";
  if (menuConfig.categories.length === 0) {
    root.innerHTML = `<p class="hint">Add some products on the Products tab first.</p>`;
    return;
  }
  const productsById = new Map(state.products.map((p) => [p.id, p]));
  menuConfig.categories.forEach((cat, catIdx) => {
    root.appendChild(renderCategoryCard(cat, catIdx, productsById));
  });
  const toggleBtn = document.getElementById("menu-toggle-all-btn");
  if (toggleBtn) {
    const anyCollapsed = menuConfig.categories.some((c) => c.collapsed);
    toggleBtn.textContent = anyCollapsed ? "⇅ Expand all" : "⇅ Collapse all";
  }
};

const renderCategoryCard = (cat, catIdx, productsById) => {
  const card = document.createElement("section");
  card.className = "menu-cat-card" + (cat.collapsed ? " collapsed" : "");

  const head = document.createElement("div");
  head.className = "menu-cat-head";

  const chevron = document.createElement("button");
  chevron.type = "button";
  chevron.className = "menu-chevron";
  chevron.setAttribute("aria-label", "Toggle category");
  chevron.setAttribute("aria-expanded", String(!cat.collapsed));
  chevron.textContent = cat.collapsed ? "▸" : "▾";
  chevron.addEventListener("click", () => {
    cat.collapsed = !cat.collapsed;
    saveMenuConfig();
    renderMenuBuilder();
  });

  const titleWrap = document.createElement("label");
  titleWrap.className = "menu-cat-title-label";
  if (!cat.collapsed) {
    titleWrap.innerHTML = `<span>Category title (printed)</span>`;
  }
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.maxLength = 80;
  titleInput.value = cat.title;
  titleInput.addEventListener("input", () => {
    cat.title = titleInput.value;
    saveMenuConfig();
    const badge = card.querySelector(".menu-cat-summary");
    if (badge) badge.dataset.title = titleInput.value;
  });
  titleWrap.appendChild(titleInput);

  const included = cat.products.filter((e) => e.included).length;
  const total = cat.products.length;
  const summary = document.createElement("span");
  summary.className = "menu-cat-summary";
  summary.title = `${included} of ${total} products included`;
  summary.innerHTML = `<strong>${included}</strong><span class="dim">/${total}</span>`;

  // Visible badge so it's obvious (even when collapsed) that this category
  // forces a page break - explains "why is this on a new page?".
  let breakBadge = null;
  if (cat.pageBreakBefore) {
    breakBadge = document.createElement("span");
    breakBadge.className = "badge";
    breakBadge.textContent = "⤓ new page";
    breakBadge.title = "This category starts on a new printed page. Use 'Clear page breaks' or untick 'Start on a new page' to remove.";
    breakBadge.style.cssText =
      "background:var(--navy);color:#fff;font-size:0.66rem;padding:0.12rem 0.45rem;border-radius:999px;white-space:nowrap";
  }

  const orderBtns = document.createElement("div");
  orderBtns.className = "menu-order-btns";
  const upBtn = mkBtn("↑ Up", "ghost small", () => moveCategoryUp(catIdx));
  const downBtn = mkBtn("↓ Down", "ghost small", () => moveCategoryDown(catIdx));
  upBtn.title = "Move this category up one position";
  downBtn.title = "Move this category down one position";
  upBtn.disabled = catIdx === 0;
  downBtn.disabled = catIdx === menuConfig.categories.length - 1;
  orderBtns.append(upBtn, downBtn);
  head.append(chevron, titleWrap, summary);
  if (breakBadge) head.append(breakBadge);
  head.append(orderBtns);

  // Allow clicking blank space on the head to toggle (but not the input or buttons).
  head.addEventListener("click", (ev) => {
    if (ev.target.closest("input, button, select, textarea, label")) return;
    cat.collapsed = !cat.collapsed;
    saveMenuConfig();
    renderMenuBuilder();
  });

  if (cat.collapsed) {
    card.appendChild(head);
    return card;
  }

  const subWrap = document.createElement("label");
  subWrap.innerHTML = `<span>Subtitle (italic)</span>`;
  const subInput = document.createElement("input");
  subInput.type = "text";
  subInput.maxLength = 120;
  subInput.value = cat.subtitle ?? "";
  subInput.addEventListener("input", () => {
    cat.subtitle = subInput.value;
    saveMenuConfig();
  });
  subWrap.appendChild(subInput);

  const optsRow = document.createElement("div");
  optsRow.className = "menu-cat-opts";

  const colsLabel = document.createElement("label");
  colsLabel.innerHTML = `<span>Columns</span>`;
  const colsRow = document.createElement("div");
  colsRow.className = "menu-cols-row";
  for (const n of [1, 2, 3, 4]) {
    const id = `menu-cols-${cat.key}-${n}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `cols-${cat.key}`;
    input.id = id;
    input.value = String(n);
    input.checked = (cat.columns ?? 2) === n;
    input.addEventListener("change", () => {
      cat.columns = n;
      saveMenuConfig();
    });
    const lbl = document.createElement("label");
    lbl.htmlFor = id;
    lbl.textContent = String(n);
    lbl.className = "menu-cols-pill";
    colsRow.append(input, lbl);
  }
  colsLabel.appendChild(colsRow);

  const unitLabel = document.createElement("label");
  unitLabel.innerHTML = `<span>Default price unit</span>`;
  const unitSel = document.createElement("select");
  for (const o of UNIT_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.value === "" ? "— use product's own —" : o.label;
    unitSel.appendChild(opt);
  }
  unitSel.value = cat.defaultUnit ?? "";
  unitSel.addEventListener("change", () => {
    cat.defaultUnit = unitSel.value;
    saveMenuConfig();
  });
  unitLabel.appendChild(unitSel);

  const photoCheck = document.createElement("label");
  photoCheck.className = "check";
  photoCheck.innerHTML = `<input type="checkbox" /> <span>Show product photos in this category</span>`;
  photoCheck.querySelector("input").checked = !!cat.showPhotos;
  photoCheck.querySelector("input").addEventListener("change", (e) => {
    cat.showPhotos = e.target.checked;
    saveMenuConfig();
  });

  const pageCheck = document.createElement("label");
  pageCheck.className = "check";
  pageCheck.innerHTML = `<input type="checkbox" /> <span>Start on a new page</span>`;
  pageCheck.querySelector("input").checked = !!cat.pageBreakBefore;
  pageCheck.querySelector("input").addEventListener("change", (e) => {
    cat.pageBreakBefore = e.target.checked;
    saveMenuConfig();
  });

  optsRow.append(colsLabel, unitLabel, photoCheck, pageCheck);

  const list = document.createElement("div");
  list.className = "menu-prod-list";
  cat.products.forEach((entry, idx) => {
    const p = productsById.get(entry.id);
    if (!p) return;
    list.appendChild(renderProductRow(cat, entry, idx, p));
  });

  const body = document.createElement("div");
  body.className = "menu-cat-body";
  body.append(subWrap, optsRow, list);
  card.append(head, body);
  return card;
};

const renderProductRow = (cat, entry, idx, p) => {
  const row = document.createElement("div");
  row.className = "menu-prod-row" + (entry.included ? "" : " excluded");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!entry.included;
  cb.title = "Include in menu";
  cb.addEventListener("change", () => {
    entry.included = cb.checked;
    row.classList.toggle("excluded", !cb.checked);
    saveMenuConfig();
  });

  const name = document.createElement("div");
  name.className = "menu-prod-name";
  name.textContent = p.name;
  const subcategory = findCategory(cat.key)?.subcategories.find((s) => s.id === p.subcategoryId);
  if (subcategory) {
    const tag = document.createElement("span");
    tag.className = "menu-prod-sub";
    tag.textContent = subcategory.label;
    name.append(" ", tag);
  }

  const priceWrap = document.createElement("div");
  priceWrap.className = "menu-prod-price";
  const priceInput = document.createElement("input");
  priceInput.type = "text";
  priceInput.placeholder = "ask staff";
  priceInput.value = entry.priceCents == null ? "" : (entry.priceCents / 100).toFixed(2);
  priceInput.inputMode = "decimal";
  priceInput.addEventListener("input", () => {
    const v = priceInput.value.trim();
    if (v === "") {
      entry.priceCents = null;
    } else {
      const n = parseFloat(v);
      entry.priceCents = isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
    }
    saveMenuConfig();
  });
  const priceDollar = document.createElement("span");
  priceDollar.textContent = "$";
  priceDollar.className = "menu-prod-dollar";
  priceWrap.append(priceDollar, priceInput);

  const unitSel = document.createElement("select");
  for (const o of UNIT_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    unitSel.appendChild(opt);
  }
  unitSel.value = entry.unitOverride ?? "";
  unitSel.title = "Unit override (overrides category & product)";
  unitSel.addEventListener("change", () => {
    entry.unitOverride = unitSel.value;
    saveMenuConfig();
  });

  const orderWrap = document.createElement("div");
  orderWrap.className = "menu-order-btns small";
  const top = mkBtn("↑", "ghost small icon", () => moveProductUp(cat, idx));
  const bot = mkBtn("↓", "ghost small icon", () => moveProductDown(cat, idx));
  top.title = "Move up one position";
  bot.title = "Move down one position";
  top.disabled = idx === 0;
  bot.disabled = idx === cat.products.length - 1;
  orderWrap.append(top, bot);

  row.append(cb, name, priceWrap, unitSel, orderWrap);
  return row;
};

const mkBtn = (text, cls, onClick) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
};

// Step-by-step reorder helpers. The arrow buttons now move one position at a
// time (swap with neighbour). Holding shift while clicking jumps to the
// extreme top/bottom for power users.
const moveCategoryUp = (idx, jumpToEdge) => {
  if (idx <= 0) return;
  if (jumpToEdge) {
    const [c] = menuConfig.categories.splice(idx, 1);
    menuConfig.categories.unshift(c);
  } else {
    const tmp = menuConfig.categories[idx - 1];
    menuConfig.categories[idx - 1] = menuConfig.categories[idx];
    menuConfig.categories[idx] = tmp;
  }
  saveMenuConfig();
  renderMenuBuilder();
};
const moveCategoryDown = (idx, jumpToEdge) => {
  if (idx >= menuConfig.categories.length - 1) return;
  if (jumpToEdge) {
    const [c] = menuConfig.categories.splice(idx, 1);
    menuConfig.categories.push(c);
  } else {
    const tmp = menuConfig.categories[idx + 1];
    menuConfig.categories[idx + 1] = menuConfig.categories[idx];
    menuConfig.categories[idx] = tmp;
  }
  saveMenuConfig();
  renderMenuBuilder();
};
const moveProductUp = (cat, idx, jumpToEdge) => {
  if (idx <= 0) return;
  if (jumpToEdge) {
    const [e] = cat.products.splice(idx, 1);
    cat.products.unshift(e);
  } else {
    const tmp = cat.products[idx - 1];
    cat.products[idx - 1] = cat.products[idx];
    cat.products[idx] = tmp;
  }
  saveMenuConfig();
  renderMenuBuilder();
};
const moveProductDown = (cat, idx, jumpToEdge) => {
  if (idx >= cat.products.length - 1) return;
  if (jumpToEdge) {
    const [e] = cat.products.splice(idx, 1);
    cat.products.push(e);
  } else {
    const tmp = cat.products[idx + 1];
    cat.products[idx + 1] = cat.products[idx];
    cat.products[idx] = tmp;
  }
  saveMenuConfig();
  renderMenuBuilder();
};

const openMenuPreview = () => {
  const productsById = new Map(state.products.map((p) => [p.id, p]));
  const payload = {
    doc: menuConfig.doc,
    gst: parseGstSettings(state.settings),
    categories: menuConfig.categories
      .map((c) => {
        const items = c.products
          .filter((e) => e.included)
          .map((e) => {
            const p = productsById.get(e.id);
            if (!p) return null;
            return {
              name: p.name,
              imagePath: p.imagePath,
              priceCents: e.priceCents,
              unit: e.unitOverride || c.defaultUnit || p.unit || "",
              qty: p.qty ?? 1,
              subcategoryId: p.subcategoryId,
            };
          })
          .filter(Boolean);
        // Same grouping as the website; the builder's own order holds inside each group.
        const groups = groupBySubcategory(items, findCategory(c.key)?.subcategories).map((g) => ({
          label: g.subcategory?.label ?? null,
          items: g.products,
        }));
        return { ...c, items, groups };
      })
      .filter((c) => c.items.length > 0),
  };
  try {
    localStorage.setItem(MENU_PREVIEW_KEY, JSON.stringify({ at: Date.now(), payload }));
  } catch {}
  window.open("/admin/menu-preview.html", "_blank", "noopener");
};

/* ---------- Uploads ---------- */
const uploadImage = async (file) => {
  const fd = new FormData();
  fd.append("image", file);
  const data = await api("/api/uploads", { method: "POST", form: fd });
  return data.imagePath;
};
