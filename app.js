/*
 * Curate: Product Explorer & Persistent Favorites Dashboard
 * Pure vanilla JavaScript. No frameworks and no build tools required.
 * Architecture: user action -> mutate state -> render() -> updated DOM.
 */
(() => {
  "use strict";

  // 1. Configuration and the single source of truth
  const API_URL = "https://fakestoreapi.com/products";
  const STORAGE_KEY = "curate_saved_favorites_v1";

  const state = {
    allItems: [],          // API data cache; never read product data back from HTML
    items: [],             // Derived, visible products
    favorites: [],         // Saved product snapshots (persisted as JSON)
    query: "",
    category: "all",
    sort: "featured",
    loading: false,
    error: null,
    storageWarning: null,
    loaded: false
  };

  // 2. Static DOM references (dynamic cards use event delegation)
  const elements = {
    searchForm: document.querySelector("#search-form"),
    searchInput: document.querySelector("#search-input"),
    resetBtn: document.querySelector("#reset-btn"),
    categoryFilters: document.querySelector("#category-filters"),
    sortSelect: document.querySelector("#sort-select"),
    statusMsg: document.querySelector("#status-msg"),
    resultsGrid: document.querySelector("#results-grid"),
    resultsCount: document.querySelector("#results-count"),
    favsList: document.querySelector("#favs-list"),
    favsCount: document.querySelector("#favs-count"),
    navFavsCount: document.querySelector("#nav-favs-count"),
    catalogCount: document.querySelector("#catalog-count"),
    summaryResultsCount: document.querySelector("#summary-results-count"),
    summaryFavsCount: document.querySelector("#summary-favs-count"),
    connectionPill: document.querySelector("#connection-pill"),
    connectionText: document.querySelector("#connection-text")
  };

  // Never insert untrusted API strings into HTML without escaping them.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeImageUrl(value) {
    if (typeof value !== "string") return "";
    try {
      const parsed = new URL(value);
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function normalizeProduct(raw) {
    if (!raw || !Number.isSafeInteger(Number(raw.id)) || String(raw.title || "").trim() === "") {
      return null;
    }
    return {
      id: Number(raw.id),
      title: String(raw.title).trim(),
      category: String(raw.category || "Uncategorized").trim(),
      price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : 0,
      image: safeImageUrl(raw.image),
      rating: Number.isFinite(Number(typeof raw.rating === "number" ? raw.rating : raw.rating?.rate))
        ? Number(typeof raw.rating === "number" ? raw.rating : raw.rating.rate)
        : null
    };
  }

  function money(price) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
  }

  // 3. Derive view data from state, then render once for every change.
  function updateVisibleItems() {
    const query = state.query.trim().toLowerCase();
    const matches = state.allItems.filter((item) => {
      const matchesQuery = item.title.toLowerCase().includes(query);
      const matchesCategory = state.category === "all" || item.category === state.category;
      return matchesQuery && matchesCategory;
    });

    if (state.sort === "price-asc") matches.sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") matches.sort((a, b) => b.price - a.price);
    if (state.sort === "title") matches.sort((a, b) => a.title.localeCompare(b.title));
    state.items = matches;
  }

  function imageMarkup(item, className) {
    if (!item.image) {
      return `<span class="product-image-fallback" aria-hidden="true">✳</span>`;
    }
    return `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">`;
  }

  function productMarkup(item, index) {
    const saved = state.favorites.some((favorite) => favorite.id === item.id);
    const rating = item.rating === null ? "" : `<span class="product-rating"><b aria-hidden="true">★</b> ${item.rating.toFixed(1)}</span>`;
    return `
      <article class="product-card">
        <div class="product-image">
          <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
          ${imageMarkup(item)}
        </div>
        <div class="product-body">
          <span class="product-category">${escapeHtml(item.category)}</span>
          <h4 class="product-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
          <div class="product-meta"><span class="product-price">${money(item.price)}</span>${rating}</div>
          <button type="button" class="btn-save" data-action="add-fav" data-id="${item.id}" ${saved ? "disabled aria-disabled=\"true\"" : ""}>
            <span aria-hidden="true">${saved ? "✓" : "♡"}</span>${saved ? "Saved to favorites" : "Save to favorites"}
          </button>
        </div>
      </article>`;
  }

  function favoriteMarkup(item) {
    return `
      <article class="favorite-card">
        <div class="favorite-image">${imageMarkup(item)}</div>
        <div class="favorite-info"><h4 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4><span>${money(item.price)}</span></div>
        <button type="button" class="btn-remove" data-action="remove-fav" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.title)} from favorites">Remove</button>
      </article>`;
  }

  function emptyMarkup(symbol, heading, description) {
    return `<div class="empty-state"><span class="empty-illustration" aria-hidden="true">${symbol}</span><h4>${heading}</h4><p>${description}</p></div>`;
  }

  function loadingMarkup() {
    return Array.from({ length: 4 }, () => `
      <div class="skeleton" aria-hidden="true"><div class="skeleton-photo"></div><div class="skeleton-body"><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-line medium"></div></div></div>
    `).join("");
  }

  function renderFilters() {
    const categories = [...new Set(state.allItems.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
    const all = ["all", ...categories];
    elements.categoryFilters.innerHTML = all.length === 1
      ? `<span class="filter-placeholder">${state.loading ? "Loading categories…" : "Categories available when connected."}</span>`
      : all.map((category) => `
        <button type="button" class="filter-chip" data-action="filter-category" data-category="${escapeHtml(category)}" aria-pressed="${state.category === category}">
          ${escapeHtml(category === "all" ? "All products" : category)}
        </button>
      `).join("");
  }

  // Single UI projection: handlers never directly patch cards, status, or counters.
  function render() {
    updateVisibleItems();
    const favCount = state.favorites.length;

    elements.favsCount.textContent = `${favCount} saved`;
    elements.navFavsCount.textContent = String(favCount);
    elements.summaryFavsCount.textContent = String(favCount);
    elements.resultsCount.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
    elements.catalogCount.textContent = state.loaded ? String(state.allItems.length) : "—";
    elements.summaryResultsCount.textContent = state.loaded ? String(state.items.length) : "—";
    elements.connectionPill.dataset.status = state.loading ? "loading" : state.error ? "error" : state.loaded ? "success" : "idle";
    elements.connectionText.textContent = state.loading ? "Connecting to catalog" : state.error ? "Connection unavailable" : state.loaded ? "Live catalog connected" : "Not connected";

    renderFilters();

    if (state.loading && !state.loaded) {
      elements.resultsGrid.innerHTML = loadingMarkup();
    } else if (state.error && !state.loaded) {
      elements.resultsGrid.innerHTML = emptyMarkup("↻", "Couldn't load the collection", "Check your connection, then use Try again to load live products.");
    } else if (!state.items.length) {
      elements.resultsGrid.innerHTML = emptyMarkup("⌕", state.loaded ? "No matching products" : "No products yet", state.loaded ? "Try another search or choose All products." : "Connect to the live catalog to get started.");
    } else {
      elements.resultsGrid.innerHTML = state.items.map(productMarkup).join("");
    }

    elements.favsList.innerHTML = state.favorites.length
      ? state.favorites.map(favoriteMarkup).join("")
      : emptyMarkup("♡", "Your list is waiting", "See something you like? Tap Save to favorites and it will appear here.");

    const warnings = [];
    if (state.loading) warnings.push(`<div class="status-banner" role="status"><span>⏳ Getting the latest products from the public API…</span></div>`);
    if (state.error) warnings.push(`<div class="status-banner error" role="alert"><span>⚠ ${escapeHtml(state.error)}</span><button type="button" class="status-button" data-action="retry">Try again</button></div>`);
    if (state.storageWarning) warnings.push(`<div class="status-banner warning" role="status"><span>${escapeHtml(state.storageWarning)}</span></div>`);
    elements.statusMsg.innerHTML = warnings.join("");
  }

  // 4. Async REST Fetch: (1) fetch, (2) response.ok, (3) response.json.
  async function fetchItems() {
    if (state.loading) return;
    state.loading = true;
    state.error = null;
    render(); // Show a visible loading state before awaiting the network.

    try {
      const response = await fetch(API_URL); // Step 1: dispatch an asynchronous request.
      if (!response.ok) {                     // Step 2: HTTP 404/500 do NOT reject fetch().
        throw new Error(`The product service returned HTTP ${response.status}. Please try again.`);
      }
      const data = await response.json();     // Step 3: parse JSON only after validation.
      if (!Array.isArray(data)) throw new Error("The product service returned unexpected data.");
      const products = data.map(normalizeProduct).filter(Boolean);
      if (!products.length) throw new Error("The product service returned no usable products.");

      state.allItems = products;
      state.loaded = true;
      if (state.category !== "all" && !products.some((item) => item.category === state.category)) {
        state.category = "all";
      }
    } catch (error) {
      state.error = error instanceof TypeError
        ? "Unable to reach the product service. Check your internet connection and try again."
        : error.message || "Something went wrong while loading the products.";
    } finally {
      state.loading = false;
      render(); // Render success or error, and keep existing favorites accessible.
    }
  }

  // 5. Safe localStorage persistence (always serialize objects to strings).
  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.favorites));
      state.storageWarning = null;
    } catch {
      state.storageWarning = "Browser storage is unavailable. Favorites may not survive a refresh.";
    }
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        state.favorites = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Saved favorites are not a list.");
      const valid = parsed.map(normalizeProduct).filter(Boolean);
      state.favorites = [...new Map(valid.map((item) => [item.id, item])).values()];
    } catch {
      state.favorites = [];
      state.storageWarning = "Saved favorites couldn't be read. You can start a new list.";
    }
  }

  // 6. State mutations: alter state, persist, then render.
  function addFavorite(id) {
    const product = state.allItems.find((item) => item.id === id);
    if (!product || state.favorites.some((item) => item.id === id)) return;
    state.favorites.push(product);
    saveFavorites();
    render();
  }

  function removeFavorite(id) {
    if (!state.favorites.some((item) => item.id === id)) return;
    state.favorites = state.favorites.filter((item) => item.id !== id);
    saveFavorites();
    render();
  }

  function searchProducts(value) {
    state.query = value;
    render();
  }

  function showAll() {
    elements.searchInput.value = "";
    elements.sortSelect.value = "featured";
    state.query = "";
    state.category = "all";
    state.sort = "featured";
    render();
    if (!state.loaded && !state.loading) fetchItems();
  }

  // 7. Single listeners on static containers; events bubble from dynamic buttons.
  function setupEventListeners() {
    elements.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      searchProducts(elements.searchInput.value);
    });
    elements.searchInput.addEventListener("input", () => searchProducts(elements.searchInput.value));
    elements.resetBtn.addEventListener("click", showAll);
    elements.sortSelect.addEventListener("change", () => {
      state.sort = elements.sortSelect.value;
      render();
    });
    elements.categoryFilters.addEventListener("click", (event) => {
      const button = event.target.closest('button[data-action="filter-category"]');
      if (!button) return;
      state.category = button.dataset.category;
      render();
    });
    elements.resultsGrid.addEventListener("click", (event) => {
      const button = event.target.closest('button[data-action="add-fav"]');
      if (button && !button.disabled) addFavorite(Number(button.dataset.id));
    });
    elements.favsList.addEventListener("click", (event) => {
      const button = event.target.closest('button[data-action="remove-fav"]');
      if (button) removeFavorite(Number(button.dataset.id));
    });
    elements.statusMsg.addEventListener("click", (event) => {
      if (event.target.closest('button[data-action="retry"]')) fetchItems();
    });
  }

  // 8. Startup: load saved state FIRST, render it, then request live data.
  function init() {
    setupEventListeners();
    loadFavorites();
    render();
    fetchItems();
  }

  init();
})();
