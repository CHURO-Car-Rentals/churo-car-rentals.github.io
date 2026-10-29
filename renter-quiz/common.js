// Shared by the quiz and the owner's verify page: scoring, fingerprints, result packing.
import BANK from "./questions.js";

export { BANK };
export const byId = Object.fromEntries(BANK.questions.map((q) => [q.id, q]));

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Is option `optId` the right answer to question `qid`? (compares against the hashed key) */
export async function isCorrect(qid, optId) {
  const q = byId[qid]; if (!q) return false;
  const text = (q.options.find(([id]) => id === optId) || [])[1]; if (text == null) return false;
  return (await sha256(`${BANK.salt}|${qid}|${optId}|${text}`)) === q.k;
}

export async function score(answers) { // answers: [{ q, a }]
  let right = 0; const marks = [];
  for (const x of answers) { const ok = await isCorrect(x.q, x.a); marks.push(ok); if (ok) right++; }
  const pct = Math.round((right / answers.length) * 100);
  return { right, total: answers.length, pct, pass: pct >= BANK.pass, marks };
}

/** Stable JSON (sorted keys) so the fingerprint doesn't depend on key order. */
export const canonical = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
export const fingerprint = (payload) => sha256(`churo-assessment|${canonical(payload)}`);

// The full result travels inside the PDF metadata so the owner can re-check it later.
export const pack = (obj) => `churo-result:${btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}`;
export const unpack = (s) => { const m = (s || "").match(/churo-result:([A-Za-z0-9+/=]+)/); return m ? JSON.parse(decodeURIComponent(escape(atob(m[1])))) : null; };
