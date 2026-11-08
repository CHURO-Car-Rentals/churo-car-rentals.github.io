// Private dashboard engine (shared by CHURO and TP & FILS). Everything site-specific lives in spec.js (window.PIT).
// Reads the Google Sheet through the Apps Script web app; every request carries the passcode. ?demo previews sample data.
(function () {
  const P = window.PIT, $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const demo = new URLSearchParams(location.search).has("demo");
  const S = { key: "", days: 30, data: null, filter: P.rec.filters[0].id, q: "", lang: P.langs[0] };
  try { const l = localStorage.getItem("pit.lang"); if (P.langs.includes(l)) S.lang = l; } catch {}
  const t = (k) => (P.t[S.lang] && P.t[S.lang][k]) ?? P.t.en[k] ?? k;
  const store = { get() { try { return localStorage.getItem("pit.key") || sessionStorage.getItem("pit.key") || ""; } catch { return ""; } },
    set(k, keep) { try { (keep ? localStorage : sessionStorage).setItem("pit.key", k); localStorage.setItem("pit.noTrack", "1"); } catch {} },
    clear() { try { localStorage.removeItem("pit.key"); sessionStorage.removeItem("pit.key"); } catch {} } };
  const toast = (m) => { const el = $("#toast"); el.textContent = m; el.classList.add("show"); clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove("show"), 2600); };

  // ---------- helpers handed to spec.js
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const day = (k, o) => new Date(String(k).slice(0, 10) + "T12:00").toLocaleDateString(t("locale"), o);
  const n = (v) => Number(v || 0).toLocaleString(t("locale"));
  const chip = (label, kind, icon) => `<span class="chip" data-k="${kind}"><i aria-hidden="true">${icon || ({ warning: "!", good: "✓", muted: "✓", critical: "✕", serious: "↗", info: "•" })[kind] || "•"}</i>${esc(label)}</span>`;
  const statusChip = (s) => chip(P.rec.label(s, S.lang), P.rec.kinds[s] || "info");
  const waLink = (phone, msg) => { let d = String(phone).replace(/\D/g, ""); if (P.phoneCountry && d.length === P.phoneCountry.len) d = P.phoneCountry.code + d; return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`; };
  function delta(cur, prev) {
    const per = t("vsPrev").replace("{n}", S.days);
    if (!prev) return cur ? `<span class="up">${t("new")}</span> ${per}` : `${t("noChange")} ${per}`;
    const p = Math.round(((cur - prev) / prev) * 100);
    return p === 0 ? `${t("same")} ${per}` : `<span class="${p > 0 ? "up" : "down"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)}%</span> ${per}`;
  }
  const H = { esc, t, day, n, chip, statusChip, waLink, delta, today, lang: () => S.lang, days: () => S.days };

  // ---------- static text
  function applyText() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
    document.querySelectorAll("[data-tp]").forEach((el) => (el.placeholder = t(el.dataset.tp)));
    $("#range").innerHTML = [7, 30, 90, 365].map((d) => `<button type="button" data-days="${d}">${d === 365 ? t("year1") : t("daysN").replace("{n}", d)}</button>`).join("");
    $("#recFilter").innerHTML = P.rec.filters.map((f) => `<button type="button" data-f="${f.id}">${esc(f.label[S.lang] || f.label.en)}</button>`).join("");
    $("#langSeg").hidden = P.langs.length < 2;
    $("#langSeg").innerHTML = P.langs.map((l) => `<button type="button" data-lang="${l}">${l.toUpperCase()}</button>`).join("");
    document.querySelectorAll("#langSeg button").forEach((b) => b.classList.toggle("on", b.dataset.lang === S.lang));
  }

  // ---------- data
  async function api(body) {
    if (demo) return demoApi(body);
    if (!P.url) throw new Error("not connected");
    const r = await fetch(P.url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ kind: "admin", key: S.key, ...body }) });
    return r.json();
  }
  const ERR = { wrong: "errWrong", locked: "errLocked", "not set up": "errSetup", "not connected": "errConnect" };
  async function load(fromLock) {
    $("#refresh").disabled = true;
    try {
      const j = await api({ action: "data", days: S.days });
      if (!j.ok) throw new Error(j.error || "failed");
      S.data = j; showApp(); render();
    } catch (e) {
      const m = t(ERR[e.message] || "errNet");
      if (fromLock || !S.data) { showLock(m); if (e.message === "wrong") store.clear(); } else toast(m);
    } finally { $("#refresh").disabled = false; }
  }
  function showLock(m) {
    const lock = $("#lock"); lock.classList.remove("ok", "leaving");
    $("#app").hidden = true; lock.hidden = false; lock.style.display = ""; $("#lockMsg").textContent = m || ""; $("#key").focus();
  }
  // a correct passcode: check mark, the lock fades away, the dashboard slides in at the top
  function showApp() {
    const lock = $("#lock"), app = $("#app");
    $("#demoNote").hidden = !demo;
    if (lock.hidden) { app.hidden = false; lock.style.display = "none"; return; }
    const quick = demo || matchMedia("(prefers-reduced-motion: reduce)").matches;
    lock.classList.add("ok");
    setTimeout(() => {
      lock.classList.add("leaving");
      setTimeout(() => {
        lock.hidden = true; lock.style.display = "none"; lock.classList.remove("ok", "leaving");
        app.hidden = false; app.classList.add("entering"); scrollTo(0, 0);
        setTimeout(() => app.classList.remove("entering"), 600);
        if (lastDaily) renderLine(lastDaily);
      }, quick ? 0 : 420);
    }, quick ? 0 : 650);
  }

  $("#lockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    S.key = $("#key").value.trim(); $("#unlock").disabled = true;
    $("#unlock").innerHTML = `<span class="lock__spin" aria-hidden="true"></span>${esc(t("unlocking"))}`; $("#lockMsg").textContent = "";
    await load(true);
    if (S.data) store.set(S.key, $("#remember").checked);
    $("#unlock").disabled = false; $("#unlock").textContent = t("unlock");
  });
  $("#signOut").onclick = () => { store.clear(); S.key = ""; S.data = null; $("#key").value = ""; showLock(t("signedOut")); };
  $("#refresh").onclick = () => load();
  document.addEventListener("click", (e) => {
    const r = e.target.closest("#range button"); if (r) { S.days = Number(r.dataset.days); load(); }
    const f = e.target.closest("#recFilter button"); if (f) { S.filter = f.dataset.f; renderRecs(); }
    const l = e.target.closest("#langSeg button");
    if (l) { S.lang = l.dataset.lang; try { localStorage.setItem("pit.lang", S.lang); } catch {} applyText(); if (S.data) render(); }
    const rv = e.target.closest("[data-reveal]"); if (rv) { rv.textContent = rv.dataset.reveal; rv.removeAttribute("data-reveal"); rv.classList.add("shown"); }
  });
  $("#recSearch").oninput = (e) => { S.q = e.target.value.toLowerCase(); renderRecs(); };
  $("#onlyMissed").onchange = renderChat;

  // ---------- render
  function render() {
    document.querySelectorAll("#range button").forEach((b) => b.classList.toggle("on", Number(b.dataset.days) === S.days));
    if (S.data.sheetUrl) { $("#sheetLink").href = S.data.sheetUrl; $("#sheetLink").hidden = false; } else $("#sheetLink").hidden = true;
    renderTiles(); renderRecs(); renderLine(S.data.stats.daily); renderBars(); renderChat();
  }
  function renderTiles() {
    const tiles = P.tiles(S.data.stats, S.data.records, H);
    $("#tiles").innerHTML = tiles.map((x, i) => `<div class="tile ${x.alert ? "tile--alert" : ""}" ${x.go ? `data-go="${i}" role="button" tabindex="0"` : ""}><div class="tile__label">${esc(x.label)}</div><div class="tile__value">${x.value}</div><div class="tile__note">${x.note || ""}</div></div>`).join("");
    document.querySelectorAll("[data-go]").forEach((el) => {
      const go = () => { S.filter = tiles[el.dataset.go].go; renderRecs(); $("#records").scrollIntoView({ behavior: "smooth" }); };
      el.onclick = go; el.onkeydown = (e) => { if (e.key === "Enter") go(); };
    });
  }
  function renderRecs() {
    document.querySelectorAll("#recFilter button").forEach((b) => b.classList.toggle("on", b.dataset.f === S.filter));
    const f = P.rec.filters.find((x) => x.id === S.filter) || P.rec.filters[0];
    let list = S.data.records.filter((o) => f.test(o, today()));
    if (f.sort) list.sort(f.sort);
    if (S.q) list = list.filter((o) => P.rec.search(o).toLowerCase().includes(S.q));
    if (!list.length) { $("#recs").innerHTML = `<p class="empty">${esc(f.empty ? f.empty[S.lang] || f.empty.en : t("nothing"))}</p>`; return; }
    $("#recs").innerHTML = list.slice(0, 150).map((o) => `<article class="rec" data-id="${esc(o.id)}">${P.rec.card(o, H)}
      <div class="rec__actions"><select aria-label="${esc(t("status"))}">${P.rec.statuses.map((s) => `<option value="${esc(s)}"${s === o.status ? " selected" : ""}>${esc(P.rec.label(s, S.lang))}</option>`).join("")}</select>
      ${P.rec.actions(o, H)}</div></article>`).join("");
    document.querySelectorAll(".rec select").forEach((sel) => (sel.onchange = async () => {
      const id = sel.closest(".rec").dataset.id, status = sel.value, o = S.data.records.find((x) => x.id === id), was = o.status;
      o.status = status; sel.disabled = true;
      try { const j = await api({ action: "status", id, status }); if (!j.ok) throw 0; toast(t("saved").replace("{name}", o.name).replace("{status}", P.rec.label(status, S.lang))); }
      catch { o.status = was; toast(t("notSaved")); }
      renderTiles(); renderRecs();
    }));
  }

  // line chart: one series (visitors), crosshair + tooltip, hairline grid
  let lastDaily = null;
  function renderLine(daily) {
    lastDaily = daily; const box = $("#lineChart"), W = box.clientWidth || 600, Hh = 230, L = 36, Rr = 12, T = 12, B = 26;
    const vals = daily.map((d) => d.visitors), max = Math.max(4, ...vals), stepY = niceStep(max / 4), top = Math.ceil(max / stepY) * stepY;
    const x = (i) => L + (daily.length < 2 ? 0 : (i * (W - L - Rr)) / (daily.length - 1)), y = (v) => T + (Hh - T - B) * (1 - v / top);
    const ticks = []; for (let v = 0; v <= top; v += stepY) ticks.push(v);
    const pts = daily.map((d, i) => `${x(i).toFixed(1)},${y(d.visitors).toFixed(1)}`);
    const xl = [0, Math.floor((daily.length - 1) / 2), daily.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    box.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(t("visitorsPerDay"))}">
      ${ticks.map((v) => `<line class="${v ? "grid" : "base"}" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}
      ${xl.map((i) => `<text class="tick" x="${x(i)}" y="${Hh - 6}" text-anchor="${i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle"}">${esc(day(daily[i].day, { month: "short", day: "numeric" }))}</text>`).join("")}
      <path class="area" d="M${x(0)},${y(0)} L${pts.join(" L")} L${x(daily.length - 1)},${y(0)} Z"/><path class="path" d="M${pts.join(" L")}"/>
      <line class="cross" id="cross" y1="${T}" y2="${Hh - B}" visibility="hidden"/><circle class="dot" id="dot" r="4.5" visibility="hidden"/>
      <rect id="hit" x="${L}" y="0" width="${W - L - Rr}" height="${Hh}" fill="transparent"/></svg>`;
    const hit = $("#hit"), cross = $("#cross"), dot = $("#dot");
    const show = (ev) => {
      const rc = box.getBoundingClientRect(), i = Math.max(0, Math.min(daily.length - 1, Math.round(((ev.clientX - rc.left - L) / (W - L - Rr)) * (daily.length - 1)))), d = daily[i];
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(d.visitors)); dot.setAttribute("visibility", "visible");
      tipShow(ev, `${d.visitors} ${t("visitors").toLowerCase()}`, `${day(d.day, { weekday: "short", month: "short", day: "numeric" })} · ${d.visits} ${t("visits")}`);
    };
    hit.onpointermove = show; hit.onpointerdown = show;
    hit.onpointerleave = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); $("#tip").hidden = true; };
    const best = daily.reduce((a, b) => (b.visitors > a.visitors ? b : a), daily[0]);
    $("#visitorsSub").textContent = t("busiest").replace("{day}", day(best.day, { weekday: "short", month: "short", day: "numeric" })).replace("{n}", best.visitors);
    $("#lineTable").innerHTML = `<table><tr><th>${esc(t("day"))}</th><th>${esc(t("visitors"))}</th><th>${esc(t("visits"))}</th></tr>${daily.slice().reverse().map((d) => `<tr><td>${esc(day(d.day, { weekday: "short", month: "short", day: "numeric" }))}</td><td>${d.visitors}</td><td>${d.visits}</td></tr>`).join("")}</table>`;
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1)))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  new ResizeObserver(() => lastDaily && !$("#app").hidden && renderLine(lastDaily)).observe($("#lineChart"));

  // ranked bars: one color, value at the end, tooltip with the share
  function bars(entries, { pct, label = (k) => k } = {}) {
    let rows = Object.entries(entries || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (rows.length > 7) { const rest = rows.slice(6).reduce((a, [, v]) => a + v, 0); rows = rows.slice(0, 6).concat([[t("other"), rest]]); }
    const total = rows.reduce((a, [, v]) => a + v, 0), max = Math.max(1, ...rows.map(([, v]) => v));
    if (!rows.length) return `<p class="empty">${esc(t("noData"))}</p>`;
    return `<div class="rows">${rows.map(([k, v]) => `<div class="row" tabindex="0" data-k="${esc(label(k))}" data-v="${v}" data-p="${((v / total) * 100).toFixed(0)}">
      <span class="row__label">${esc(label(k))}</span><span class="row__track"><span class="row__bar" style="display:block;width:${((v / max) * 100).toFixed(1)}%"></span></span>
      <span class="row__val">${pct ? ((v / total) * 100).toFixed(0) + "%" : n(v)}</span></div>`).join("")}</div>`;
  }
  function renderBars() {
    const st = S.data.stats, SRC = P.t[S.lang].src || P.t.en.src, DEV = P.t[S.lang].dev || P.t.en.dev;
    const list = [{ title: t("sources"), sub: t("shareVisits"), html: bars(st.sources, { pct: true, label: (k) => SRC[k] || k }) },
      { title: t("devices"), sub: t("shareVisits"), html: bars(st.devices, { pct: true, label: (k) => DEV[k] || k }) }]
      .concat(P.charts(st, H).map((c) => ({ title: c.title, sub: c.sub, html: bars(c.entries, c) })));
    $("#barCharts").innerHTML = list.map((c) => `<article class="panel chart"><h2>${esc(c.title)}</h2><p class="sub">${esc(c.sub || "")}</p>${c.html}</article>`).join("");
    document.querySelectorAll("#barCharts .row").forEach((r) => {
      const on = (ev) => tipShow(ev, `${n(r.dataset.v)} · ${r.dataset.p}%`, r.dataset.k);
      r.onpointermove = on; r.onfocus = () => { const b = r.getBoundingClientRect(); on({ clientX: b.right - 60, clientY: b.top }); };
      r.onpointerleave = r.onblur = () => ($("#tip").hidden = true);
    });
  }
  function renderChat() {
    const only = $("#onlyMissed").checked, list = S.data.stats.chat.filter((c) => !only || !c.answered);
    $("#qs").innerHTML = list.length ? list.map((c) => `<li><q>${esc(c.q)}</q>${c.answered ? chip(t("answered"), "good") : chip(t("sentWa"), "serious", "↗")}<time>${esc(c.at.replace("T", " "))}</time></li>`).join("")
      : `<p class="empty">${esc(only ? t("allAnswered") : t("noChat"))}</p>`;
  }
  function tipShow(ev, strong, text) {
    const el = $("#tip"); el.replaceChildren(); const s = document.createElement("strong"); s.textContent = strong; el.append(s, document.createTextNode(text));
    el.hidden = false; const w = el.offsetWidth, h = el.offsetHeight;
    let left = ev.clientX + 14, top = ev.clientY - h - 12; if (left + w > innerWidth - 8) left = ev.clientX - w - 14; if (top < 8) top = ev.clientY + 16;
    el.style.left = left + "px"; el.style.top = top + "px";
  }

  // ---------- demo (?demo)
  let demoData = null;
  function demoApi(body) {
    if (body.action === "status") return { ok: true };
    demoData = demoData || P.demo(H);
    return { ok: true, sheetUrl: "", days: S.days, records: demoData.records, stats: P.demoStats(S.days, demoData.records, H) };
  }

  // ---------- start
  applyText();
  if (demo) { load(true); return; }
  if (!P.url) { showLock(t("errConnect")); return; }
  S.key = store.get();
  if (S.key) { $("#lock").classList.add("ok"); $("#okText").textContent = t("welcome"); load(true); } else showLock("");
})();
