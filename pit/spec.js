// CHURO dashboard: what the shared engine (dash.js) shows for this site.
window.PIT = {
  url: "",                                                                   // Apps Script web app URL (…/exec), same as js/track.js
  langs: ["en"],
  phoneCountry: { len: 10, code: "1" },
  t: pitText({ en: { title: "CHURO dashboard", recTitle: "Renter assessments", search: "Search name, phone, license, result ID…" } }),

  rec: {
    statuses: ["Pending review", "Approved", "Declined", "Retake needed"],
    kinds: { "Pending review": "warning", Approved: "good", Declined: "critical", "Retake needed": "muted" },
    label: (s) => s,
    filters: [
      { id: "review", label: { en: "To review" }, test: (o) => o.pass && o.status === "Pending review", empty: { en: "No passed assessments waiting for review. ✓" } },
      { id: "passed", label: { en: "Passed" }, test: (o) => o.pass },
      { id: "failed", label: { en: "Not passed" }, test: (o) => !o.pass },
      { id: "all", label: { en: "All" }, test: () => true },
    ],
    search: (o) => [o.name, o.phone, o.email, o.dl, o.id].join(" "),
    card(o, h) {
      const age = o.dob ? Math.floor((Date.now() - new Date(o.dob + "T12:00")) / 31557600000) : null;
      const mask = o.dl ? "•••• " + o.dl.replace(/[^A-Z0-9]/gi, "").slice(-4) : "";
      return `<div class="rec__when"><span>${h.esc(o.pass ? "PASSED" : "NOT PASSED")}</span><b class="rec__score">${o.pct}%</b><span>${o.right}/${o.total} · try #${o.attempt}</span></div>
        <div class="rec__who">
          <h3>${h.esc(o.name)} ${h.statusChip(o.status)} ${o.fast ? `<span class="badge flag">${o.fast} rushed answers</span>` : ""}</h3>
          <div class="rec__meta">${h.esc(o.phone)}${o.email ? " · " + h.esc(o.email) : ""}</div>
          <div class="rec__meta">License: <b>${h.esc(o.dlState || "?")}</b> ${o.dl ? `<span class="reveal" data-reveal="${h.esc(o.dl)}" title="Click to show the full number">${h.esc(mask)}</span>` : ""}
            ${o.dob ? ` · DOB ${h.esc(o.dob)} (${age < 21 ? `<span class="flag">age ${age}</span>` : `age ${age}`})` : ""}</div>
          ${o.dlFlags ? `<div class="rec__meta flag">⚠ License check: ${h.esc(o.dlFlags)}</div>` : ""}
          <div class="rec__ref">${h.esc(o.id)} · ${h.esc(o.at.replace("T", " "))} · ${o.minutes} min${o.source ? " · via " + h.esc((h.t("src")[o.source]) || o.source) : ""}</div>
        </div>`;
    },
    actions(o, h) {
      const first = o.name.trim().split(/\s+/)[0];
      const msg = o.pass ? `Hi ${first}, this is CHURO. Thanks for completing the renter assessment (${o.id}). You're approved on our side: let's set up your rental!`
        : `Hi ${first}, this is CHURO. Thanks for taking the renter assessment (${o.id}). It needs 95% to pass, so please review your rental agreement and retake it when you're ready.`;
      return `<a class="btn btn--wa" target="_blank" rel="noopener" href="${h.waLink(o.phone, msg)}">💬 WhatsApp</a>
        <a class="btn btn--ghost" href="tel:${h.esc(o.phone.replace(/[^\d+]/g, ""))}">📞 Call</a>
        ${o.dlState === "FL" ? `<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://services.flhsmv.gov/DLCheck/" title="Check this license on FLHSMV">🔎 FLHSMV check</a>` : ""}`;
    },
  },

  tiles(st, recs, h) {
    const waiting = recs.filter((o) => o.pass && o.status === "Pending review"), s = st.records.summary || {}, tp = st.cur.taps;
    const done = (s.passed || 0) + (s.failed || 0);
    return [
      { label: "Assessments to review", value: h.n(waiting.length), alert: waiting.length > 0, go: "review", note: waiting.length ? `${h.chip("Pending review", "warning")}` : "All caught up ✓" },
      { label: "Assessments taken", value: h.n(st.records.cur), note: `${done ? Math.round(((s.passed || 0) / done) * 100) + "% passed · " : ""}${h.delta(st.records.cur, st.records.prev)}` },
      { label: "Visitors", value: h.n(st.cur.visitors), note: h.delta(st.cur.visitors, st.prev.visitors) },
      { label: "Book clicks", value: h.n(tp.book), note: `${h.n(tp.turo)} went to Turo` },
      { label: "WhatsApp taps", value: h.n(tp.wa), note: `${h.n(tp.call)} calls · ${h.n(tp.text)} texts` },
      { label: "Chatbot questions", value: h.n((tp.chat_q || 0) + (tp.chat_miss || 0)), note: `${h.n(tp.chat_miss)} handed to WhatsApp` },
    ];
  },
  charts(st) {
    const tp = st.cur.taps;
    return [
      { title: "Book clicks by car", sub: "Which cars people want", entries: st.details.book },
      { title: "Taps", sub: "How visitors reached out", entries: { "WhatsApp": tp.wa, "Call": tp.call, "Text": tp.text, "Book": tp.book, "Turo": tp.turo, "Chatbot opened": tp.chat_open, "Started the assessment": tp.quiz_start } },
    ];
  },

  // ---------- sample data for ?demo
  demo() {
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const names = ["Sample: Jordan P.", "Sample: Maria L.", "Sample: Andre W.", "Sample: Kelly S.", "Sample: Tom B.", "Sample: Priya K.", "Sample: Luis G.", "Sample: Dana R."];
    const k = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const records = [];
    for (let i = 0; i < 22; i++) {
      const at = new Date(Date.now() - (i < 4 ? i * 0.7 : 2 + r() * 80) * 864e5), pass = r() < .72, pct = pass ? 95 + Math.floor(r() * 6) : 70 + Math.floor(r() * 24);
      const dob = new Date(Date.now() - (20.5 + r() * 30) * 31557600000);
      records.push({ id: "CH-" + Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + (10 + i), at: k(at) + "T" + String(9 + Math.floor(r() * 10)).padStart(2, "0") + ":" + String(Math.floor(r() * 60)).padStart(2, "0"),
        name: names[i % names.length], phone: "(941) 555-01" + (10 + i), email: "", dob: k(dob), dlState: r() < .8 ? "FL" : "GA", dl: "S" + String(Math.floor(r() * 1e12)).padStart(12, "0"),
        dlFlags: r() < .1 ? "check digit mismatch" : "", pct, right: Math.round(pct * 0.2), total: 20, pass, attempt: pass && r() < .2 ? 2 : 1, minutes: Math.round(8 + r() * 14), fast: r() < .15 ? 2 : 0,
        status: !pass ? "Retake needed" : i < 4 ? "Pending review" : r() < .85 ? "Approved" : "Declined", notes: "", source: ["google", "qr", "direct", "turo"][Math.floor(r() * 4)] });
    }
    return { records };
  },
  demoStats(days, records) {
    let seed = days * 3 + 1; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const k = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, daily = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5), v = Math.round((d.getDay() % 6 ? 18 : 11) + r() * 14); daily.push({ day: k(d), visitors: v, visits: Math.round(v * 1.3) }); }
    const vis = daily.reduce((a, d) => a + d.visitors, 0), f = days / 30, cur = records.filter((o) => o.at.slice(0, 10) >= daily[0].day);
    return { cur: { visits: Math.round(vis * 1.3), visitors: vis, taps: { wa: Math.round(36 * f), call: Math.round(14 * f), text: Math.round(9 * f), book: Math.round(27 * f), turo: Math.round(12 * f), chat_open: Math.round(48 * f), chat_q: Math.round(80 * f), chat_miss: Math.round(7 * f), quiz_start: Math.round(cur.length * 1.4) } },
      prev: { visits: 0, visitors: Math.round(vis * .88), taps: {} }, daily,
      sources: { google: Math.round(vis * .38), turo: Math.round(vis * .22), direct: Math.round(vis * .2), qr: Math.round(vis * .12), instagram: Math.round(vis * .08) },
      devices: { phone: Math.round(vis * .76), desktop: Math.round(vis * .2), tablet: Math.round(vis * .04) },
      details: { book: { "2023 Nissan Sentra SV": Math.round(9 * f), "2021 Toyota Camry SE": Math.round(7 * f), "2020 Honda Civic": Math.round(5 * f), "2022 Kia Forte": Math.round(4 * f), "2019 Chevrolet Malibu": Math.round(2 * f) } },
      records: { cur: cur.length, prev: Math.round(cur.length * .8), summary: { passed: cur.filter((o) => o.pass).length, failed: cur.filter((o) => !o.pass).length } },
      chat: [["do you have a car with apple carplay", 1], ["can I use the car for uber", 1], ["do you have a tesla", 1], ["can I pick up at the airport at 2am", 0], ["what's the cheapest car on gas", 1], ["do you take credit card", 1], ["can my brother drive too", 0]]
        .map(([q, a], i) => ({ at: k(new Date(Date.now() - i * 1.9 * 864e5)) + "T1" + i + ":0" + i, q, answered: !!a })) };
  },
};
