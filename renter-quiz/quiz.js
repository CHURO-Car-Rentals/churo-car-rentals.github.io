// Renter assessment: rules -> renter details -> 20 scenarios (3 fixed + 17 random, answers shuffled) ->
// attestation + signature -> score -> results PDF (with an embedded, fingerprinted copy of every answer).
import CONFIG from "./config.js?v=202610291442";
import { BANK, byId, score, fingerprint, pack } from "./common.js?v=202610291442";
import { checkLicense, STATES, FLHSMV_CHECK } from "./license.js?v=202610291442";

const PDFLIB = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js";
const app = document.getElementById("app"), bar = document.getElementById("progress");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get: (k, s = localStorage) => { try { return JSON.parse(s.getItem(k)); } catch { return null; } }, set: (k, v, s = localStorage) => { try { s.setItem(k, JSON.stringify(v)); } catch {} }, del: (k, s = localStorage) => { try { s.removeItem(k); } catch {} } };
const SESSION = "churo.quiz.session", META = "churo.quiz.meta";
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rid = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => c[b % c.length]).join("").replace(/(.{5})/, "$1-"); };
const fmtDur = (s) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

// in-progress test survives a refresh (so refreshing can't be used to re-roll easier questions)
let S = store.get(SESSION, sessionStorage);
const meta = store.get(META) || { attempts: 0, lockUntil: 0 };

function newSession() {
  const fixed = BANK.questions.filter((q) => q.always), rest = shuffle(BANK.questions.filter((q) => !q.always));
  const picked = shuffle([...fixed, ...rest.slice(0, BANK.count - fixed.length)]);
  S = { id: rid(), step: "info", i: 0, renter: {}, items: picked.map((q) => ({ q: q.id, order: shuffle(q.options.map(([id]) => id)), a: null, ms: 0 })), started: null, shown: null };
  save();
}
const save = () => store.set(SESSION, S, sessionStorage);

function render() {
  bar.hidden = !(S && S.step === "q");
  if (meta.lockUntil > Date.now() && (!S || S.step === "info")) return locked();
  if (!S) return intro();
  ({ info, q: question, attest, done: result }[S.step] || intro)();
}

function intro() {
  app.innerHTML = `<div class="card"><h1>Before you rent, a short assessment</h1>
    <p class="muted">Every renter completes this. It checks that you understand our rental requirements and the rules of the rental agreement you'll sign, using real situations renters have faced.</p>
    <ul class="rules">
      <li><span><b>${BANK.count} questions</b>, multiple choice, about ${Math.max(8, CONFIG.minMinutes + 4)} minutes.</span></li>
      <li><span>You need <b>${BANK.pass}% or more</b> (${Math.ceil((BANK.pass / 100) * BANK.count)} of ${BANK.count}) to be approved.</span></li>
      <li><span>Your score appears only after you submit. Read every situation carefully.</span></li>
      <li><span>Answer on your own, without help. You'll sign a statement confirming this.</span></li>
      <li><span>At the end you'll get a <b>results PDF</b>. Send it to us to complete your booking. It becomes part of your rental records.</span></li>
      ${meta.attempts ? `<li><span>This is attempt <b>#${meta.attempts + 1}</b> on this device. After a failed attempt you can retake it after ${CONFIG.retakeHours} hours.</span></li>` : ""}
    </ul>
    <div class="row"><span class="muted" style="font-size:.85rem">${esc(CONFIG.brand)} · ${esc(CONFIG.business)}</span><button class="btn btn--primary" id="go">Start</button></div></div>`;
  app.querySelector("#go").onclick = () => { newSession(); render(); };
}

function locked() {
  const h = Math.ceil((meta.lockUntil - Date.now()) / 3.6e6);
  app.innerHTML = `<div class="card"><h1>Retake available later</h1><p>Your last attempt didn't reach ${BANK.pass}%. Please review your rental agreement, especially the topics listed in your results PDF. You can retake the assessment in about <b>${h} hour${h === 1 ? "" : "s"}</b>.</p></div>`;
}

function info() {
  const r = S.renter;
  app.innerHTML = `<div class="card"><h2>Your details</h2><p class="muted">Use your name and license number exactly as printed on your driver's license.</p>
    <form id="f" class="fields" novalidate>
      <label class="f full">Full legal name (first, middle, last)<input type="text" name="name" required autocomplete="name" value="${esc(r.name || "")}" /></label>
      <label class="f">Date of birth<input type="date" name="dob" required max="${new Date().toISOString().slice(0, 10)}" value="${esc(r.dob || "")}" /></label>
      <label class="f">License state<select name="dlState">${STATES.map((x) => `<option${x === (r.dlState || "FL") ? " selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="f full">Driver's license number<input type="text" name="dl" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Florida: A123-456-78-901-0" value="${esc(r.dl || "")}" /></label>
      <div class="full" id="dlMsg"></div>
      <label class="f">Phone<input type="tel" name="phone" required autocomplete="tel" value="${esc(r.phone || "")}" /></label>
      <label class="f">Email<input type="email" name="email" required autocomplete="email" value="${esc(r.email || "")}" /></label>
      <label class="check full"><input type="checkbox" name="ok" required /> <span>I'm taking this assessment myself, without help from anyone, and my answers will be shared with ${esc(CONFIG.business)} as part of my rental application.</span></label>
      <div class="row full"><button type="button" class="btn btn--ghost" id="back">Back</button><button class="btn btn--primary">Continue</button></div>
    </form></div>`;
  const form = app.querySelector("#f"), msg = app.querySelector("#dlMsg");
  app.querySelector("#back").onclick = () => { store.del(SESSION, sessionStorage); S = null; render(); };
  let confirmedFlags = "";
  const live = () => {
    const d = Object.fromEntries(new FormData(form));
    if (!d.dl.trim()) { msg.innerHTML = ""; return null; }
    const c = checkLicense(d.dl, d.dlState, d.name, d.dob);
    const key = c.flags.join("|");
    msg.innerHTML = c.errors.length ? `<div class="note bad-note">${c.errors.map(esc).join("<br>")}</div>`
      : c.flags.length ? `<div class="note"><b>Please double-check your license number.</b><br>${c.flags.map(esc).join("<br>")}<label class="check" style="margin-top:10px"><input type="checkbox" id="dlConfirm" ${confirmedFlags === key ? "checked" : ""}/> <span>I checked: the number is exactly as printed on my license. (This will be noted on my results.)</span></label></div>`
      : d.dlState === "FL" ? `<p class="ok" style="margin:0;font-size:.88rem">✓ License number format matches your name and date of birth.</p>` : "";
    const cb = msg.querySelector("#dlConfirm"); if (cb) cb.onchange = () => (confirmedFlags = cb.checked ? key : "");
    return c;
  };
  form.addEventListener("input", (e) => { if (["dl", "name", "dob", "dlState"].includes(e.target.name)) live(); });
  form.addEventListener("change", (e) => { if (e.target.name === "dlState") live(); });
  if (r.dl) live();
  form.onsubmit = (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(form));
    const missing = ["name", "dob", "dl", "phone", "email"].filter((k) => !String(d[k] || "").trim());
    if (missing.length || !d.ok) { form.reportValidity(); return; }
    if (d.name.trim().split(/\s+/).length < 2) { msg.innerHTML = `<div class="note bad-note">Please enter your full legal name (first and last).</div>`; return; }
    const age = (Date.now() - new Date(d.dob)) / 3.15576e10; if (age < 16 || age > 110) { msg.innerHTML = `<div class="note bad-note">Please check your date of birth.</div>`; return; }
    if (age < CONFIG.minAge) { app.innerHTML = `<div class="card"><h1>Renters must be ${CONFIG.minAge} or older</h1><p>Thanks for your interest in ${esc(CONFIG.brand)}. You can rent with us once you turn ${CONFIG.minAge}.</p><p><a class="btn btn--ghost" href="../">Back to the website</a></p></div>`; store.del(SESSION, sessionStorage); S = null; return; }
    const c = live(); if (!c || c.errors.length) return;
    if (c.flags.length && confirmedFlags !== c.flags.join("|")) { msg.querySelector(".note")?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    S.renter = { name: d.name.trim().replace(/\s+/g, " "), dob: d.dob, dl: c.normalized, dlState: d.dlState === "Other / international" ? "Other" : d.dlState, phone: d.phone.trim(), email: d.email.trim(), dlFlags: c.flags };
    S.step = "q"; S.i = 0; S.started = Date.now(); save(); render();
  };
}


function question() {
  const it = S.items[S.i], q = byId[it.q];
  bar.firstElementChild.style.width = `${(S.i / S.items.length) * 100}%`;
  S.shown = Date.now(); save();
  app.innerHTML = `<div class="card"><div class="qmeta"><span>Question ${S.i + 1} of ${S.items.length}</span><span>${esc(q.topic)}</span></div>
    <p class="scenario">${esc(q.q)}</p>
    <div class="opts">${it.order.map((id, n) => `<button type="button" class="opt${it.a === id ? " on" : ""}" data-id="${id}"><span class="dot"></span><span>${esc(q.options.find(([x]) => x === id)[1])}</span></button>`).join("")}</div>
    <div class="row"><button class="btn btn--ghost" id="prev" ${S.i === 0 ? "disabled" : ""}>Back</button><button class="btn btn--primary" id="next" ${it.a ? "" : "disabled"}>${S.i === S.items.length - 1 ? "Review & sign" : "Next"}</button></div></div>`;
  const next = app.querySelector("#next");
  app.querySelectorAll(".opt").forEach((b) => b.onclick = () => { it.a = b.dataset.id; app.querySelectorAll(".opt").forEach((x) => x.classList.toggle("on", x === b)); next.disabled = false; save(); });
  const leave = () => { it.ms += Date.now() - S.shown; };
  app.querySelector("#prev").onclick = () => { leave(); S.i--; save(); render(); };
  next.onclick = () => { leave(); if (S.i < S.items.length - 1) S.i++; else S.step = "attest"; save(); render(); };
}

function attest() {
  bar.firstElementChild.style.width = "100%";
  const min = CONFIG.minMinutes * 60e3;
  app.innerHTML = `<div class="card"><h2>Confirm and sign</h2>
    <p>I, <b>${esc(S.renter.name)}</b>, confirm that I answered these questions myself, without help, and that I understand the rental requirements and the rules of the rental agreement they describe. I understand my answers and this signature will be kept with my rental records.</p>
    <label class="f">Type your full legal name to confirm<input type="text" id="typed" autocomplete="off" placeholder="${esc(S.renter.name)}" /></label>
    <p style="margin:16px 0 6px;font-weight:600;font-size:.88rem">Sign below</p>
    <canvas class="sig" id="sig" width="900" height="300"></canvas>
    <div class="row" style="margin-top:8px"><button class="btn btn--ghost" id="clear" type="button">Clear signature</button><button class="btn btn--ghost" id="review" type="button">Back to questions</button></div>
    <div class="note" id="wait" hidden></div>
    <div class="row"><span></span><button class="btn btn--primary" id="submit" disabled>Submit my answers</button></div></div>`;
  const c = app.querySelector("#sig"), g = c.getContext("2d"); g.lineWidth = 4; g.lineCap = g.lineJoin = "round"; g.strokeStyle = "#071a33";
  let drawing = false, last = null, ink = 0;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)]; };
  c.onpointerdown = (e) => { drawing = true; last = pos(e); c.setPointerCapture(e.pointerId); };
  c.onpointermove = (e) => { if (!drawing) return; const p = pos(e); g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); ink += Math.hypot(p[0] - last[0], p[1] - last[1]); last = p; check(); };
  c.onpointerup = () => (drawing = false);
  app.querySelector("#clear").onclick = () => { g.clearRect(0, 0, c.width, c.height); ink = 0; check(); };
  app.querySelector("#review").onclick = () => { S.step = "q"; S.i = 0; save(); render(); };
  const typed = app.querySelector("#typed"), submit = app.querySelector("#submit"), wait = app.querySelector("#wait");
  const norm = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();
  function check() {
    const left = min - (Date.now() - S.started);
    wait.hidden = left <= 0; if (left > 0) wait.textContent = `Please take your time. You can submit in ${Math.ceil(left / 1000)} seconds. Use the time to review your answers.`;
    submit.disabled = !(norm(typed.value) === norm(S.renter.name) && ink > 150 && left <= 0);
  }
  typed.oninput = check; const t = setInterval(() => { if (!document.body.contains(submit)) return clearInterval(t); check(); }, 1000); check();
  submit.onclick = async () => {
    submit.disabled = true; submit.innerHTML = '<span class="spin"></span>Scoring…';
    S.signature = c.toDataURL("image/png"); S.finished = Date.now(); S.typed = typed.value.trim();
    S.step = "done"; save(); render();
  };
}

async function result() {
  app.innerHTML = `<div class="card"><p><span class="spin"></span>Scoring your answers…</p></div>`;
  const answers = S.items.map((x) => ({ q: x.q, a: x.a, ms: Math.round(x.ms) }));
  const sc = await score(answers);
  if (!S.recorded) { meta.attempts += 1; if (!sc.pass) meta.lockUntil = Date.now() + CONFIG.retakeHours * 3.6e6; else meta.lockUntil = 0; store.set(META, meta); S.recorded = true; S.attempt = meta.attempts; save(); }
  const fast = answers.filter((x) => x.ms < CONFIG.fastSeconds * 1000).length;
  const payload = { v: 1, resultId: S.id, renter: S.renter, typedName: S.typed, started: new Date(S.started).toISOString(), finished: new Date(S.finished).toISOString(), seconds: Math.round((S.finished - S.started) / 1000), attempt: S.attempt, device: navigator.userAgent, bank: BANK.salt.slice(0, 8), answers, score: { right: sc.right, total: sc.total, pct: sc.pct, pass: sc.pass }, fastAnswers: fast };
  const fp = await fingerprint(payload);
  const missed = [...new Set(answers.filter((_, i) => !sc.marks[i]).map((x) => byId[x.q].topic))];
  app.innerHTML = `<div class="card ${sc.pass ? "pass" : "fail"}"><div class="score"><div class="score__ring" style="--p:${sc.pct}"><span>${sc.pct}%</span></div><span class="badge">${sc.pass ? "PASSED" : "NOT PASSED"}</span>
    <p>${sc.right} of ${sc.total} correct · ${BANK.pass}% required</p></div>
    ${sc.pass ? `<p>Thank you, ${esc(S.renter.name.split(" ")[0])}. Download your results PDF and send it to us to continue your booking.</p>` : `<p>You didn't reach ${BANK.pass}%. Please review your rental agreement on these topics, then retake the assessment after ${CONFIG.retakeHours} hours:</p><ul class="missed">${missed.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`}
    <div class="kv"><b>Result ID</b><span>${S.id}</span><b>Completed</b><span>${new Date(S.finished).toLocaleString()}</span><b>Time taken</b><span>${fmtDur(payload.seconds)}</span><b>Attempt</b><span>#${S.attempt}</span></div>
    <div class="row"><button class="btn btn--ghost" id="new" ${sc.pass ? "" : "hidden"}>Done</button><span></span><button class="btn btn--primary" id="pdf"><span class="spin"></span>Preparing your PDF…</button></div>
    ${sc.pass && S.renter.dlState === "FL" ? `<div class="note" style="margin-top:18px"><b>Optional:</b> you can check your license status on the official Florida (FLHSMV) website. We also verify it before your rental.<br><a class="btn btn--ghost" id="dlcheck" style="margin-top:10px" href="${FLHSMV_CHECK}" target="_blank" rel="noopener">Check my license on FLHSMV ↗</a></div>` : ""}
    <p class="muted" id="sent" style="font-size:.85rem;margin-top:10px"></p></div>`;
  const btn = app.querySelector("#pdf");
  const file = await makePdf(payload, fp, sc, missed);
  btn.innerHTML = navigator.canShare?.({ files: [file] }) ? "Share results PDF" : "Download results PDF";
  btn.onclick = async () => {
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "Renter assessment results", text: `My CHURO renter assessment results (${S.id})` }); return; } catch (e) { if (e.name === "AbortError") return; } }
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: file.name }); document.body.appendChild(a); a.click(); a.remove();
  };
  app.querySelector("#dlcheck")?.addEventListener("click", () => navigator.clipboard?.writeText(S.renter.dl.replace(/-/g, "")).catch(() => {}));
  app.querySelector("#new").onclick = () => { store.del(SESSION, sessionStorage); S = null; render(); };
  const sent = app.querySelector("#sent");
  if (S.sent) sent.textContent = "A copy of your results was sent to the owner.";
  else if (CONFIG.web3formsKey) sendCopy(payload, fp, sc).then(() => { S.sent = true; save(); sent.textContent = "A copy of your results was sent to the owner."; })
    .catch(() => { sent.innerHTML = `We couldn't send a copy automatically. Please <a href="#" id="textUs">text us your results PDF</a>.`; sent.querySelector("#textUs").onclick = (e) => { e.preventDefault(); location.href = `sms:${CONFIG.ownerPhone.join("")}`; }; });
}

async function sendCopy(p, fp, sc) {
  const lines = p.answers.map((x, i) => `${i + 1}. [${sc.marks[i] ? "OK" : "X"}] ${byId[x.q].topic}: ${byId[x.q].options.find(([id]) => id === x.a)?.[1]} (${Math.round(x.ms / 1000)}s)`);
  const body = { access_key: CONFIG.web3formsKey, subject: `Renter assessment ${sc.pass ? "PASSED" : "FAILED"} ${sc.pct}% · ${p.renter.name} · ${p.resultId}`, from_name: "CHURO renter assessment", name: p.renter.name, email: p.renter.email,
    message: `${p.renter.name} · born ${p.renter.dob} · DL ${p.renter.dl} (${p.renter.dlState}) · ${p.renter.phone} · ${p.renter.email}\nLicense check: ${p.renter.dlFlags?.length ? "FLAGGED: " + p.renter.dlFlags.join(" ") : "OK"}\nScore ${sc.right}/${sc.total} (${sc.pct}%) · ${sc.pass ? "PASSED" : "FAILED"} · attempt #${p.attempt} · ${Math.round(p.seconds / 60)} min · fast answers: ${p.fastAnswers}\nResult ID ${p.resultId} · fingerprint ${fp}\nCompleted ${p.finished}\n\n${lines.join("\n")}\n\n${pack({ ...p, fingerprint: fp })}` };
  // plain form post (no CORS preflight), the way Web3Forms recommends for browsers
  const form = new FormData(); for (const [k, v] of Object.entries(body)) form.append(k, v);
  const r = await fetch("https://api.web3forms.com/submit", { method: "POST", body: form, headers: { Accept: "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(j.message || "send failed");
}

// ---------------------------------------------------------------- results PDF
async function makePdf(p, fp, sc, missed) {
  const { PDFDocument, StandardFonts, rgb } = await import(PDFLIB);
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const INK = rgb(0.03, 0.1, 0.2), MUTED = rgb(0.36, 0.42, 0.5), BLUE = rgb(0.09, 0.41, 0.89), OK = rgb(0.07, 0.64, 0.42), BAD = rgb(0.9, 0.28, 0.3), LINE = rgb(0.84, 0.89, 0.93);
  const clean = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  const W = 612, H = 792, M = 54; let page, y;
  const wrap = (text, f, size, width) => { const words = clean(text).split(" "), lines = []; let line = ""; for (const w of words) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; };
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };
  const need = (h) => { if (y - h < M + 30) newPage(); };
  const text = (s, { f = font, size = 10.5, color = INK, x = M, width = W - 2 * M, gap = 3 } = {}) => { for (const l of wrap(s, f, size, width)) { need(size + gap); page.drawText(l, { x, y: y - size, size, font: f, color }); y -= size + gap; } };
  newPage();
  try { const logo = await doc.embedJpg(await (await fetch("../logo.jpg")).arrayBuffer()); page.drawImage(logo, { x: M, y: H - M - 56, width: 56, height: 56 }); } catch {}
  page.drawText("Renter Assessment Results", { x: M + 70, y: H - M - 24, size: 20, font: bold, color: INK });
  page.drawText(clean(`${CONFIG.brand} · ${CONFIG.business}`), { x: M + 70, y: H - M - 42, size: 10, font, color: MUTED });
  y = H - M - 80;
  // result banner
  page.drawRectangle({ x: M, y: y - 64, width: W - 2 * M, height: 64, color: sc.pass ? rgb(0.89, 0.97, 0.93) : rgb(0.99, 0.91, 0.91) });
  page.drawText(sc.pass ? "PASSED" : "NOT PASSED", { x: M + 16, y: y - 30, size: 20, font: bold, color: sc.pass ? OK : BAD });
  page.drawText(`${sc.right} of ${sc.total} correct · ${sc.pct}% · ${BANK.pass}% required`, { x: M + 16, y: y - 50, size: 11, font, color: INK });
  y -= 84;
  const row = (k, v) => { need(16); page.drawText(clean(k), { x: M, y: y - 10, size: 10, font: bold, color: MUTED }); for (const [i, l] of wrap(v, font, 10, W - 2 * M - 150).entries()) { if (i) { need(14); } page.drawText(l, { x: M + 150, y: y - 10, size: 10, font, color: INK }); y -= 14; } y -= 2; };
  row("Renter (legal name)", p.renter.name); row("Driver's license", `${p.renter.dl} (${p.renter.dlState}) · born ${p.renter.dob}`);
  row("License number check", p.renter.dlState === "FL" ? (p.renter.dlFlags?.length ? `FLAGGED, renter confirmed the number: ${p.renter.dlFlags.join(" ")}` : "Matches last name and date of birth (Florida format)") : "Format checked (non-Florida license)"); row("Phone / email", `${p.renter.phone} · ${p.renter.email}`);
  row("Started", `${new Date(p.started).toLocaleString()} (${p.started})`); row("Submitted", `${new Date(p.finished).toLocaleString()} (${p.finished})`);
  row("Time taken", fmtDur(p.seconds)); row("Attempt", `#${p.attempt} on this device`); row("Result ID", p.resultId);
  row("Fingerprint (SHA-256)", fp); row("Device", p.device.slice(0, 160));
  if (p.fastAnswers) row("Note", `${p.fastAnswers} answer(s) were given in under ${CONFIG.fastSeconds} seconds.`);
  if (!sc.pass) row("Topics to review", missed.join("; "));
  y -= 10; need(130);
  page.drawText("Renter's statement", { x: M, y: y - 12, size: 12, font: bold, color: INK }); y -= 22;
  text(`I, ${p.renter.name}, confirm that I answered these questions myself, without help, and that I understand the rental requirements and the rules of the rental agreement they describe. I understand my answers and this signature will be kept with my rental records. Typed name: "${p.typedName}".`, { size: 10 });
  try { const sig = await doc.embedPng(S.signature); const sw = 210, sh = (sw * sig.height) / sig.width; need(sh + 24); page.drawImage(sig, { x: M, y: y - sh, width: sw, height: sh }); y -= sh + 2; page.drawLine({ start: { x: M, y }, end: { x: M + sw, y }, thickness: 0.8, color: MUTED }); y -= 12; page.drawText("Renter's signature", { x: M, y, size: 9, font, color: MUTED }); y -= 16; } catch {}
  // answers
  newPage(); page.drawText("Questions and answers", { x: M, y: y - 14, size: 15, font: bold, color: INK }); y -= 26;
  text("Each situation below was shown in this order with the answer choices in this order. The renter's choice is marked [X]. Questions are drawn at random from a larger set; the contract section each one relates to is listed.", { size: 9, color: MUTED }); y -= 6;
  p.answers.forEach((x, i) => {
    const q = byId[x.q], item = S.items[i];
    need(60);
    page.drawLine({ start: { x: M, y: y - 2 }, end: { x: W - M, y: y - 2 }, thickness: 0.6, color: LINE }); y -= 10;
    text(`${i + 1}. ${q.topic}`, { f: bold, size: 10.5 });
    text(`Contract: ${q.clause} · answered in ${Math.round(x.ms / 1000)} s · ${sc.marks[i] ? "CORRECT" : "INCORRECT"}`, { size: 8.5, color: sc.marks[i] ? OK : BAD });
    text(q.q, { size: 10 });
    for (const id of item.order) { const t = q.options.find(([o]) => o === id)[1]; text(`${id === x.a ? "[X]" : "[  ]"} ${t}`, { size: 9.5, x: M + 10, width: W - 2 * M - 10, color: id === x.a ? INK : MUTED, f: id === x.a ? bold : font }); }
    y -= 6;
  });
  // footer on every page + embedded copy of the result (for the owner's verify page)
  const pages = doc.getPages();
  pages.forEach((pg, i) => { pg.drawText(clean(`Result ID ${p.resultId} · fingerprint ${fp.slice(0, 16)}… · page ${i + 1} of ${pages.length}`), { x: M, y: 28, size: 8, font, color: MUTED }); });
  doc.setTitle(`Renter assessment ${p.resultId} - ${p.renter.name}`); doc.setAuthor(clean(p.renter.name)); doc.setCreator("CHURO renter assessment"); doc.setSubject(`${sc.pct}% ${sc.pass ? "PASSED" : "NOT PASSED"}`);
  doc.setKeywords([pack({ ...p, fingerprint: fp })]);
  const bytes = await doc.save();
  const safe = p.renter.name.replace(/[^A-Za-z0-9]+/g, "_");
  return new File([bytes], `CHURO_assessment_${safe}_${p.resultId}.pdf`, { type: "application/pdf" });
}

render();
