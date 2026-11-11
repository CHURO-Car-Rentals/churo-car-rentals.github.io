/* =========================================================
   CHURO — live fleet from the CHURO Portal
   The owner edits prices, status and details in the portal
   (churocarrental.pythonanywhere.com/admin). This file loads
   them so the website always shows the latest numbers.
   - Last copy is cached so repeat visits show it instantly.
   - If the portal can't be reached, data.js is used as-is.
   Load order: data.js → live.js → app.js
   ========================================================= */
(function () {
  const C = window.CHURO;
  if (!C || !C.company.portalUrl || !C.applyLive) return;
  const KEY = "churo-live-fleet";

  // 1) Cached copy (from a previous visit, same day or newer data) before the page draws
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || "null");
    if (cached) C.applyLive(cached);
  } catch (e) { /* storage blocked: fine */ }

  // 2) Fresh copy, then re-draw
  const ctrl = "AbortController" in window ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 8000);
  fetch(C.company.portalUrl + "/api/fleet.json", { cache: "no-cache", signal: ctrl && ctrl.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((live) => {
      if (!C.applyLive(live)) return;
      try { localStorage.setItem(KEY, JSON.stringify(live)); } catch (e) { /* ignore */ }
      const redraw = () => window.ChuroApp && window.ChuroApp.refresh && window.ChuroApp.refresh();
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", redraw);
      else redraw();
    })
    .catch(() => { /* offline or portal asleep: keep built-in prices */ })
    .finally(() => clearTimeout(timer));
})();
