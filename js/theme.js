/* =========================================================
   CHURO — color themes (hidden 🎨 button in the footer)
   Classic is the default. Auto follows Sarasota time:
   Sunrise (5–12), Classic (12–17), Dusk (17–5).
   Every theme keeps CHURO's navy and teal; the time of day shows in the background glow.
   The visitor's choice is remembered on their device.
   Loaded in <head> so the saved theme applies before the page shows.
   ========================================================= */
(function () {
  const KEY = "churo-site-theme";
  const THEMES = [
    ["classic", "Classic", "Navy & ocean blue (default)"],
    ["auto", "Auto", "Follows the time of day"],
    ["sunrise", "Sunrise", "Warm morning glow"],
    ["gulf", "Gulf", "CHURO teal & deep sea"],
    ["dusk", "Dusk", "Evening violet glow"],
  ];
  const saved = () => {
    try { const v = localStorage.getItem(KEY) || "classic"; return v === "sunset" ? "dusk" : v; }   // "Sunset" was renamed "Dusk"
    catch (e) { return "classic"; }
  };
  const byClock = () => {
    const h = +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date());
    return h >= 5 && h < 12 ? "sunrise" : h >= 12 && h < 17 ? "classic" : "dusk";
  };
  // Preview without saving: add ?theme=sunrise (or classic, auto, gulf, dusk) to the address
  const preview = new URLSearchParams(location.search).get("theme");
  let choice = THEMES.some(([id]) => id === preview) ? preview : saved();
  function apply() {
    const t = choice === "auto" ? byClock() : choice;
    if (t === "classic") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll("[data-theme-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themePick === choice)));
    const now = document.querySelector("[data-auto-now]");                 // "Follows the time of day · now: Dusk"
    if (now) now.textContent = ` · now: ${THEMES.find(([id]) => id === t)[1]}`;
  }
  apply();
  setInterval(() => { if (choice === "auto") apply(); }, 5 * 60 * 1000);

  document.addEventListener("DOMContentLoaded", () => {
    const host = document.getElementById("themePicker");
    if (!host) return;
    host.innerHTML =
      `<button type="button" class="themer__btn" aria-expanded="false" aria-label="Change colors" title="Change colors">🎨</button>
       <div class="themer__menu" role="group" aria-label="Color theme" hidden>
         ${THEMES.map(([id, name, desc]) => `<button type="button" data-theme-pick="${id}"><span class="swatch swatch--${id}"></span><span><b>${name}</b><small>${desc}${id === "auto" ? '<span data-auto-now></span>' : ""}</small></span></button>`).join("")}
       </div>`;
    const btn = host.querySelector(".themer__btn"), menu = host.querySelector(".themer__menu");
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); });
    menu.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-theme-pick]");
      if (!pick) return;
      choice = pick.dataset.themePick;
      try { localStorage.setItem(KEY, choice); } catch (err) { /* private mode: this visit only */ }
      apply();
      setTimeout(close, 250);                                               // let them see the change, then fold away
    });
    document.addEventListener("click", (e) => { if (!host.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    apply();
  });
})();
