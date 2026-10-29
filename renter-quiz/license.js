// Driver license number checks. Florida numbers are built from the person's details:
// SSSS-FFF-YY-DDD-N  =  Soundex of last name · first name/middle code · birth year · (month-1)*40 + day (+500 female) · overflow digit.
// We check the format, the last-name code and the birthday digits. Mismatches are flagged, not blocked
// (a legal name change can leave an older number).

export const FLHSMV_CHECK = "https://services.flhsmv.gov/DLCheck/";

export const STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "Other / international"];

/** American Soundex: letter + 3 digits (Smith -> S530, Robert -> R163). */
export function soundex(name) {
  const s = String(name).toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";
  const code = (c) => ("BFPV".includes(c) ? "1" : "CGJKQSXZ".includes(c) ? "2" : "DT".includes(c) ? "3" : c === "L" ? "4" : "MN".includes(c) ? "5" : c === "R" ? "6" : "");
  let out = s[0], last = code(s[0]);
  for (let i = 1; i < s.length && out.length < 4; i++) {
    const c = s[i], d = code(c);
    if (d && d !== last) out += d;
    if ("HW".includes(c)) continue; // H and W don't separate equal codes
    last = d;
  }
  return out.padEnd(4, "0");
}

/** Possible last names from a full legal name (handles "De La Cruz", "Smith-Jones", "Jr."). */
function surnames(full) {
  const words = String(full).replace(/\b(JR|SR|II|III|IV)\.?$/i, "").trim().split(/\s+/);
  if (words.length < 2) return [];
  const out = new Set([words[words.length - 1], words.slice(1).join(""), words.slice(-2).join("")]);
  for (const w of words.slice(1)) for (const part of w.split("-")) out.add(part);
  return [...out].filter(Boolean);
}

/**
 * Returns { ok, normalized, errors[] (must fix), flags[] (recorded, renter must confirm) }.
 * dob = "YYYY-MM-DD"
 */
export function checkLicense(dl, state, fullName, dob) {
  const errors = [], flags = [];
  const raw = String(dl).toUpperCase().replace(/[\s-]/g, "");
  if (state === "FL") {
    if (!/^[A-Z]\d{12}$/.test(raw)) {
      errors.push(raw.length < 13 ? `A Florida license number has 13 characters (1 letter + 12 digits). You entered ${raw.length}.` : raw.length > 13 ? `A Florida license number has 13 characters (1 letter + 12 digits). You entered ${raw.length}.` : "A Florida license number is 1 letter followed by 12 digits.");
      return { ok: false, normalized: raw, errors, flags };
    }
    const names = surnames(fullName), codes = names.map(soundex), code = raw.slice(0, 4);
    if (names.length && !names.some((n) => n[0].toUpperCase() === raw[0])) flags.push(`The license starts with "${raw[0]}", but the last name "${names[0]}" starts with "${names[0][0].toUpperCase()}".`);
    else if (names.length && !codes.includes(code)) flags.push(`The first 4 characters (${code}) don't match the last name's code (${codes[0]}).`);
    if (dob) {
      const [y, m, d] = dob.split("-").map(Number);
      if (raw.slice(7, 9) !== String(y % 100).padStart(2, "0")) flags.push(`Characters 8-9 (${raw.slice(7, 9)}) don't match the birth year ${y}.`);
      const ddd = Number(raw.slice(9, 12)), base = (m - 1) * 40 + d;
      if (ddd !== base && ddd !== base + 500) flags.push(`Characters 10-12 (${raw.slice(9, 12)}) don't match the birth date (expected ${String(base).padStart(3, "0")} or ${base + 500}).`);
    }
    const pretty = `${raw.slice(0, 4)}-${raw.slice(4, 7)}-${raw.slice(7, 9)}-${raw.slice(9, 12)}-${raw[12]}`;
    return { ok: true, normalized: pretty, errors, flags };
  }
  if (!/^[A-Z0-9]{4,20}$/.test(raw)) errors.push("Enter the license number exactly as printed: letters and numbers only, 4 to 20 characters.");
  return { ok: !errors.length, normalized: raw, errors, flags };
}
