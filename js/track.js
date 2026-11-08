// Anonymous, cookie-free activity for CHURO's private dashboard: one "visit" per browsing session, plus taps
// (WhatsApp, Call, Text, Book, Turo, chatbot, renter assessment). Sends nothing until SET.url is filled in.
// Devices that signed in to the dashboard are skipped, so the owner's own visits don't count.
(function () {
  const SET = {
    url: "https://script.google.com/macros/s/AKfycbyXd0SA0f1Xag4VpuXvwtqu_uaA7fZM5IvYLbz630i8418bHfdhkUx0iRyGqQYi78Al/exec",                                                                 // Apps Script web app URL (…/exec), see apps-script/SETUP.md
    pit: new URL("pit/", document.currentScript.src.replace(/js\/track\.js.*$/, "")).href,
    countVisit: !/renter-quiz/.test(location.pathname),                      // the assessment counts its own steps
  };
  const store = (s, k) => { try { let v = s.getItem(k); if (!v) { v = Math.random().toString(36).slice(2, 10); s.setItem(k, v); } return v; } catch { return "anon"; } };
  const skip = (() => { try { return localStorage.getItem("pit.noTrack") === "1"; } catch { return false; } })();
  const visitor = store(window.localStorage, "pit.v"), session = store(window.sessionStorage, "pit.s");

  const qs = new URLSearchParams(location.search);
  let ref = ""; try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch {}
  if (ref === location.hostname) ref = "";
  const from = (h) => /google\./.test(h) ? "google" : /instagram\./.test(h) ? "instagram" : /facebook\.|fb\./.test(h) ? "facebook"
    : /bing\./.test(h) ? "bing" : /yahoo\./.test(h) ? "yahoo" : /whatsapp|wa\.me/.test(h) ? "whatsapp" : /turo\./.test(h) ? "turo" : h ? h : "direct";
  const source = (qs.get("src") || qs.get("utm_source") || "").toLowerCase().slice(0, 30) || from(ref);
  const device = matchMedia("(pointer: coarse)").matches ? (Math.min(screen.width, screen.height) < 600 ? "phone" : "tablet") : "desktop";
  const base = { visitor, session, source, ref, device, page: location.pathname };

  function post(body) {
    const data = JSON.stringify(body);
    try { if (navigator.sendBeacon && navigator.sendBeacon(SET.url, new Blob([data], { type: "text/plain" }))) return; } catch {}
    fetch(SET.url, { method: "POST", mode: "no-cors", body: data, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => {});
  }

  window.SiteTrack = {
    source,
    event(type, detail) { if (SET.url && !skip) post({ kind: "event", type, detail: String(detail == null ? "" : detail).slice(0, 300), ...base }); },
    // records (assessment results, quote requests) are always saved, even from the owner's own devices
    record(kind, d) { if (SET.url) post({ kind, ...d, visitor, source }); },
  };

  // one "visit" per browsing session
  // only mark the visit as counted once it was really sent (not while unconnected or on a signed-in device)
  if (SET.countVisit !== false && SET.url && !skip) {
    try { if (!sessionStorage.getItem("pit.seen")) { sessionStorage.setItem("pit.seen", "1"); SiteTrack.event("visit", SET.visitDetail ? SET.visitDetail() : ""); } }
    catch { SiteTrack.event("visit"); }
  }

  // the private dashboard: five quick taps on the footer's © line (nothing on the page links to it)
  let taps = [];
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#copyLine")) return;
    const now = Date.now(); taps = taps.filter((t) => now - t < 2500).concat(now);
    if (taps.length >= 5) location.href = SET.pit;
  });
})();
