/**
 * CHURO: Google Sheet backend for the website.
 *  - saves every renter assessment result (score, pass/fail, license info) to the "Assessments" tab
 *  - records anonymous site activity to the "Events" tab (visits, WhatsApp/Call/Text taps, Book clicks, chatbot)
 *  - serves the private dashboard (website /pit/), only with the admin passcode
 * The passcode lives in Project Settings > Script properties as ADMIN_KEY, never in the website's code.
 * Setup steps: apps-script/SETUP.md
 */
const SITE = {
  name: "CHURO",
  events: ["visit", "wa", "call", "text", "book", "turo", "chat_open", "chat_q", "chat_miss", "quiz_start", "quiz_pass", "quiz_fail", "directions"],
  detailEvents: ["book"],                                                // "Book" clicks are counted per car
  record: {
    kind: "assessment", tab: "Assessments", clientId: true,
    headers: ["Result ID", "Completed", "Name", "Phone", "Email", "Date of birth", "License state", "License number", "License flags",
      "Score %", "Correct", "Total", "Result", "Attempt", "Minutes", "Fast answers", "Status", "Notes", "Source"],
    statusHeader: "Status", notesHeader: "Notes",
    statuses: ["Pending review", "Approved", "Declined", "Retake needed"],
    colors: { "Pending review": "#fff4d6", Approved: "#dff3df", Declined: "#f8dddd", "Retake needed": "#eeeeee" },
    widths: [150, 150, 170, 130, 200, 110, 90, 150, 140, 70, 70, 60, 90, 70, 80, 100, 130, 220, 90],
    validate: (d) => (clean(d.resultId, 40) && clean(d.name, 80) ? "" : "missing"),
    build(d, now) {
      const pass = !!d.pass, id = clean(d.resultId, 40);
      return { id, row: [id, now, clean(d.name, 80), clean(d.phone, 30), clean(d.email, 120), clean(d.dob, 10), clean(d.dlState, 20),
        clean(d.dl, 30), clean(d.dlFlags, 120), Number(d.pct) || 0, Number(d.right) || 0, Number(d.total) || 0, pass ? "PASSED" : "FAILED",
        Number(d.attempt) || 1, Math.round((Number(d.seconds) || 0) / 6) / 10, Number(d.fast) || 0, pass ? "Pending review" : "Retake needed", "", clean(d.source, 30)] };
    },
    read: (r, tz) => ({ id: str(r[0]), at: iso(r[1]), name: str(r[2]), phone: str(r[3]), email: str(r[4]), dob: day(r[5], tz), dlState: str(r[6]),
      dl: str(r[7]), dlFlags: str(r[8]), pct: Number(r[9]) || 0, right: Number(r[10]) || 0, total: Number(r[11]) || 0, pass: r[12] === "PASSED",
      attempt: Number(r[13]) || 1, minutes: Number(r[14]) || 0, fast: Number(r[15]) || 0, status: str(r[16]), notes: str(r[17]), source: str(r[18]) }),
    dateOf: (o) => o.at,
    summary: (list) => ({ passed: list.filter((o) => o.pass).length, failed: list.filter((o) => !o.pass).length }),
  },
};

// ======================================================================================================
// Core (identical on every site; the SITE block above is the only part that differs)
// ======================================================================================================
const EVENTS_TAB = "Events";
const EVENT_HEADERS = ["Time", "Type", "Detail", "Visitor", "Session", "Source", "Referrer", "Device", "Page"];
const REC = SITE.record;
const COL = { id: 1, status: REC.headers.indexOf(REC.statusHeader) + 1, notes: REC.headers.indexOf(REC.notesHeader) + 1 };

// ---------- one-time setup (run from the editor)
function setup() {
  const ss = SpreadsheetApp.getActive();
  [[REC.tab, REC.headers], [EVENTS_TAB, EVENT_HEADERS]].forEach(([name, head]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold").setBackground("#1a1a19").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  });
  const r = ss.getSheetByName(REC.tab), statusRange = r.getRange(2, COL.status, 2000, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(REC.statuses, true).build());
  r.setConditionalFormatRules(Object.keys(REC.colors).map((v) =>
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(v).setBackground(REC.colors[v]).setRanges([statusRange]).build()));
  (REC.widths || []).forEach((w, i) => r.setColumnWidth(i + 1, w));
  const first = ss.getSheetByName("Sheet1") || ss.getSheetByName("Feuille 1");
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(first);
  if (!PropertiesService.getScriptProperties().getProperty("ADMIN_KEY")) Logger.log("Now add ADMIN_KEY in Project Settings > Script properties.");
  Logger.log("Setup done.");
}

// ---------- web endpoints
function doGet() { return json({ ok: true, service: SITE.name }); }

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: "bad request" }); }
  try {
    if (body.kind === REC.kind) return json(saveRecord(body));
    if (body.kind === "event") return json(saveEvent(body));
    if (body.kind === "admin") return json(admin(body));
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "server" });
  }
  return json({ ok: false, error: "unknown" });
}

// ---------- records (bookings / assessments / quote requests)
function saveRecord(d) {
  if (d.botcheck) return { ok: true };
  const problem = REC.validate(d);
  if (problem) return { ok: false, error: problem };
  if (!allow("rec:" + (clean(d.visitor, 20) || clean(d.phone, 30) || "anon"), 6, 3600)) return { ok: false, error: "slow down" };
  if (!allow("rec:all", 60, 3600)) return { ok: false, error: "slow down" };   // site-wide cap: a spammer can fake visitor IDs
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(), now = new Date();
  const out = REC.build(d, now, tz);
  if (REC.clientId && findRow(out.id)) return { ok: true, id: out.id, duplicate: true };   // same result sent twice
  withLock(() => sheet(REC.tab).appendRow(out.row.map(safeCell)));
  return { ok: true, id: out.id };
}

// ---------- anonymous activity
function saveEvent(d) {
  const type = String(d.type || "");
  if (SITE.events.indexOf(type) < 0) return { ok: false };
  if (!allow("ev:" + (clean(d.visitor, 20) || "anon"), 80, 600)) return { ok: false, error: "slow down" };
  if (!allow("ev:all", 2000, 3600)) return { ok: false, error: "slow down" };   // site-wide cap keeps the Sheet from being flooded
  const row = [new Date(), type, clean(d.detail, 300), clean(d.visitor, 20), clean(d.session, 20), clean(d.source, 30) || "direct",
    clean(d.ref, 80), clean(d.device, 10), clean(d.page, 60)];
  withLock(() => sheet(EVENTS_TAB).appendRow(row.map(safeCell)));
  return { ok: true };
}

// ---------- private dashboard
function admin(d) {
  const gate = checkKey(d.key);
  if (gate !== true) return { ok: false, error: gate };
  if (d.action === "status") return setStatus(d.id, d.status, d.notes);
  const days = [7, 30, 90, 365].indexOf(Number(d.days)) >= 0 ? Number(d.days) : 30;
  return { ok: true, site: SITE.name, sheetUrl: SpreadsheetApp.getActive().getUrl(), tz: SpreadsheetApp.getActive().getSpreadsheetTimeZone(), days, records: listRecords(), stats: stats(days) };
}

function checkKey(key) {
  const cache = CacheService.getScriptCache(), fails = Number(cache.get("fails") || 0);
  if (fails >= 8) return "locked";                                      // 8 wrong tries -> 15 minute lockout
  const real = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!real || real.length < 8) return "not set up";
  if (String(key || "") === real) return true;
  cache.put("fails", String(fails + 1), 900);
  return "wrong";
}

function listRecords() {
  const sh = sheet(REC.tab), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(), take = Math.min(n, 600);
  return sh.getRange(sh.getLastRow() - take + 1, 1, take, REC.headers.length).getValues().reverse().map((r) => REC.read(r, tz));
}

function findRow(id) {
  const sh = sheet(REC.tab), n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = sh.getRange(2, COL.id, n, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function setStatus(id, status, notes) {
  if (REC.statuses.indexOf(status) < 0) return { ok: false, error: "bad status" };
  const row = findRow(id);
  if (!row) return { ok: false, error: "not found" };
  const sh = sheet(REC.tab);
  withLock(() => {
    sh.getRange(row, COL.status).setValue(status);
    if (typeof notes === "string") sh.getRange(row, COL.notes).setValue(safeCell(clean(notes, 500)));
  });
  return { ok: true };
}

// Aggregates Events + records for the chosen period and the one before it (for "vs. previous period").
function stats(days) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(), DAY = 86400000;
  const todayKey = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(Utilities.formatDate(new Date(Date.now() - i * DAY), tz, "yyyy-MM-dd"));
  const startKey = keys[0], prevStartKey = Utilities.formatDate(new Date(Date.now() - (2 * days - 1) * DAY), tz, "yyyy-MM-dd");
  const period = (k) => (k >= startKey && k <= todayKey ? "cur" : k >= prevStartKey && k < startKey ? "prev" : null);
  const blank = () => ({ visits: 0, visitors: {}, taps: {} });
  const S = { cur: blank(), prev: blank() }, perDay = {}, perDayVisitors = {}, sources = {}, devices = {}, details = {}, chat = [];
  keys.forEach((k) => { perDay[k] = 0; perDayVisitors[k] = {}; });
  (SITE.detailEvents || []).forEach((t) => (details[t] = {}));

  const ev = sheet(EVENTS_TAB), n = ev.getLastRow() - 1;
  if (n > 0) {
    const take = Math.min(n, 60000);
    ev.getRange(ev.getLastRow() - take + 1, 1, take, EVENT_HEADERS.length).getValues().forEach((r) => {
      if (!(r[0] instanceof Date)) return;
      const k = Utilities.formatDate(r[0], tz, "yyyy-MM-dd"), p = period(k);
      if (!p) return;
      const type = String(r[1]), b = S[p];
      b.taps[type] = (b.taps[type] || 0) + 1;
      if (type === "visit") {
        b.visits++; b.visitors[r[3]] = 1;
        if (p === "cur") {
          perDay[k]++; perDayVisitors[k][r[3]] = 1;
          const src = String(r[5] || "direct"); sources[src] = (sources[src] || 0) + 1;
          const dev = String(r[7] || "unknown"); devices[dev] = (devices[dev] || 0) + 1;
        }
      }
      if (p === "cur" && details[type] && r[2] !== "") details[type][String(r[2])] = (details[type][String(r[2])] || 0) + 1;
      if (p === "cur" && (type === "chat_q" || type === "chat_miss")) chat.push({ at: iso(r[0]), q: String(r[2]), answered: type === "chat_q" });
    });
  }

  const recs = { cur: 0, prev: 0 }, inPeriod = [];
  listRecords().forEach((o) => {
    const p = period(String(REC.dateOf(o)).slice(0, 10));
    if (!p) return;
    recs[p]++;
    if (p === "cur") inPeriod.push(o);
  });
  recs.summary = REC.summary ? REC.summary(inPeriod) : {};

  const pack = (b) => ({ visits: b.visits, visitors: Object.keys(b.visitors).length, taps: b.taps });
  return {
    cur: pack(S.cur), prev: pack(S.prev),
    daily: keys.map((k) => ({ day: k, visits: perDay[k], visitors: Object.keys(perDayVisitors[k]).length })),
    sources, devices, details, records: recs, chat: chat.reverse().slice(0, 60),
  };
}

// ---------- helpers
function sheet(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    const head = name === EVENTS_TAB ? EVENT_HEADERS : REC.headers;
    sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold"); sh.setFrozenRows(1);
  }
  return sh;
}
function clean(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max); }
function safeCell(v) { return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v; }   // no formula injection
function str(v) { return String(v == null ? "" : v).replace(/^'/, ""); }
function iso(v) { return v instanceof Date ? Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm") : String(v || ""); }
function day(v, tz) { return v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : String(v || ""); }
function newId(prefix, now, tz) { return prefix + "-" + Utilities.formatDate(now, tz, "MMdd") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(10000); try { fn(); } finally { l.releaseLock(); } }
function allow(key, max, seconds) {
  const c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (n >= max) return false;
  c.put(key, String(n + 1), seconds);
  return true;
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
