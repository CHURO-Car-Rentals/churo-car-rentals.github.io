/* =========================================================
   Churo — CHURO Car Rentals' AI assistant
   ---------------------------------------------------------
   Three interchangeable engines, all free:
     1. Ollama   – a model running on this computer (http://localhost:11434)
     2. WebLLM   – an open model downloaded into the browser (WebGPU)
     3. Built-in – an offline, rule-based assistant (always available)
   "Auto" uses Ollama only when the site itself runs locally;
   public visitors get the built-in assistant.

   Every engine is grounded in js/data.js. Before an LLM answers,
   the built-in analyzer pre-computes exact prices / Rent-to-Own
   payments and hands them to the model so it can't invent numbers.
   ========================================================= */
(function () {
  const C = window.CHURO;
  const P = C.policies;
  const money = C.money;
  const $ = (s) => document.querySelector(s);

  const CONFIG = {
    ollamaUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    webllmModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    webllmCdn: "https://esm.run/@mlc-ai/web-llm",
    maxHistory: 4,
    llmTimeoutMs: 25000, // customers never wait longer than this; the built-in answer is shown instead
  };
  // Only auto-probe localhost when the site itself runs locally. On a public host
  // (e.g. GitHub Pages) probing would trigger Chrome's "local network access" prompt.
  const IS_LOCAL_SITE = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
  const STORE = { chat: "churo.chat.v1", settings: "churo.chat.settings" };

  /* =======================================================
     Utilities
     ======================================================= */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const isoDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  /** Tiny, safe markdown: **bold**, *italic*, `code`, [links](url), lists, paragraphs. */
  function md(src) {
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[\w-]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const out = [];
    let list = null;
    for (const raw of src.split("\n")) {
      const line = raw.trimEnd();
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      if (ul || ol) {
        const tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) { if (list) out.push(`</${list.tag}>`); list = { tag }; out.push(`<${tag}>`); }
        out.push(`<li>${inline((ul || ol)[1])}</li>`);
        continue;
      }
      if (list) { out.push(`</${list.tag}>`); list = null; }
      const h = line.match(/^#{1,6}\s+(.*)/);
      if (h) out.push(`<p><strong>${inline(h[1])}</strong></p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list.tag}>`);
    return out.join("");
  }


  /* =======================================================
     Knowledge → system prompt (for LLM engines)
     ======================================================= */
  // Compact on purpose: on a CPU-only computer every prompt token costs time.
  // Prices and payment math are answered by the built-in engine; the model handles everything else.
  function buildSystemPrompt() {
    const avail = C.fleet.filter((c) => c.status === "available")
      .map((c) => `${C.carName(c)} (${c.color.toLowerCase()} ${c.type}, ${c.seats || 5} seats) $${c.weekly}/wk`).join("; ");
    const soon = C.fleet.filter((c) => c.status === "soon").map((c) => C.carName(c)).join(", ");
    return `You are Churo, the assistant for CHURO Car Rentals, a family-run rental business in Sarasota, Florida (501+ Turo trips, 4.9 stars). You talk TO customers; you are never the customer. Answer in 1-4 short sentences, warm and clear.

FACTS
- Options: daily or weekly rental (weekly is heavily discounted); Rent-to-Own with no credit check; buy with cash (clean title).
- Cars available: ${avail}.${soon ? ` Coming soon: ${soon}.` : ""}
- To rent: valid Florida driver's license + 2 different recent proofs of address in your name (utility bill, paystub, bank statement). Insurance card optional. Age 21+.
- Daily rental deposit: $200 with 2 proofs of address, otherwise up to $1,000 depending on the car; refunded minus tolls, citations, fees.
- Payment: cash, Apple Pay, Venmo, Chime or Zelle. Do not mention or offer card payments.
- Pick-up and return in Sarasota, FL 34234 (round trip). Delivery within 15 miles of 34234 costs $140.
- Drive anywhere in Florida; cars are GPS-tracked and NOT allowed outside Florida. 200 miles per day included.
- Cars are cleaned, sanitized and fully inspected before every rental; pre- and post-trip photos are taken each time.
- To book: use the "Book now" link (it notifies the owner). Questions: tell them to tap "Call us" or "Text us" (never write out a phone number). Before the first rental every renter completes the renter assessment at renter-quiz/ (95% needed). Extensions: tell us before the rental ends.
- Rent-to-Own: rent 1 week first, then sign and notarize at MIDFLORIDA with the down payment and proof of insurance; weekly or bi-weekly payments, 12 months max, no monthly plans; customer handles maintenance; Uber/DoorDash/gig work ONLY with the owner's explicit written authorization (same as rentals); nothing illegal.

RULES
- Never invent prices, fees, numbers or policies. Don't quote any price not listed above; for exact prices or payments, point to the car tiles or the payment calculator.
- If unsure, say so and suggest the Call us / Text us buttons. Never share anything about other customers.`;
  }

  /* =======================================================
     Built-in analyzer (NLU) — entities + intents
     ======================================================= */
  const COLORS = ["silver", "white", "black", "gray", "grey", "blue"];

  /** Find which car(s) a message refers to. Returns { cars: [ids], exact: bool } */
  function matchCars(t) {
    const scored = C.fleet.map((c) => {
      let s = 0, model = false;
      if (new RegExp(`\\b${c.model.toLowerCase()}\\b`).test(t)) { s += 3; model = true; }
      if ((c.model === "Sentra" && /nissan/.test(t)) || (c.make === "Tesla" && /tesla|\bev\b|electric/.test(t))) { s += 3; model = true; }
      if (new RegExp(`\\b(${c.year}|'?${String(c.year).slice(2)})\\b`).test(t)) s += 3;
      if (new RegExp(`\\b${c.trim.toLowerCase()}\\b`).test(t)) s += 1;
      const col = c.color.toLowerCase();
      if (COLORS.some((k) => t.includes(k) && (col.includes(k) || (k === "grey" && col.includes("gray")) || (k === "gray" && col.includes("grey"))))) s += 2;
      return { c, s, model };
    }).filter((x) => x.model);
    if (!scored.length) return { cars: [], exact: false };
    const best = Math.max(...scored.map((x) => x.s));
    const top = scored.filter((x) => x.s === best).map((x) => x.c.id);
    return { cars: top, exact: top.length === 1 && best > 3 };
  }

  function analyze(text, ctx) {
    const t = " " + text.toLowerCase().replace(/[’']/g, "'") + " ";
    const e = { raw: t };
    const m0 = matchCars(t);
    e.cars = m0.cars; e.exact = m0.exact;
    if (!e.cars.length && ctx.candidates) {
      // follow-up like "the grey one" / "the 2019" after we asked "which one?"
      const pickd = ctx.candidates.map(C.byId).filter((c) =>
        t.includes(String(c.year)) || COLORS.some((k) => t.includes(k) && c.color.toLowerCase().replace("grey", "gray").includes(k.replace("grey", "gray"))));
      if (pickd.length === 1) e.cars = [pickd[0].id];
    }

    let m;
    if ((m = t.match(/(\d+)\s*(?:days?|nights?)\b/))) e.days = +m[1];
    else if ((m = t.match(/(?<!every\s)(?<!every other\s)\b(\d+)\s*weeks?\b/))) e.days = +m[1] * 7;
    else if (/\b(a|one|1) week\b/.test(t)) e.days = 7;
    else if (/\bweekend\b/.test(t)) e.days = 3;
    if ((m = t.match(/(\d{1,2})\s*(?:months?|mo)\b/))) e.months = +m[1];
    else if (/\b(a|one) year\b|\b12 months\b/.test(t)) e.months = 12;
    if (/(my own|own (insurance|policy)|i have insurance|bring (my|mine))/.test(t)) ctx.insurance = "own";
    else if (/(your|churo'?s?) insurance|use yours|use your/.test(t)) ctx.insurance = "churo";
    if (/bi-?weekly|every (two|2) weeks|every other week/.test(t)) e.frequency = "biweekly";
    else if (/\bweekly (payment|plan)|pay (weekly|every week)|per week payment|each week|every week/.test(t)) e.frequency = "weekly";
    if (/\bsuvs?\b|7[ -]?seat|third row|3rd row|family|group|kids/.test(t)) e.type = "SUV";
    else if (/\bsedans?\b|small car|compact/.test(t)) e.type = "Sedan";
    if ((m = t.match(/(?:under|below|less than|max(?:imum)?|budget(?: of| is)?|up to|afford)\s*\$?\s*(\d{2,5})/))) e.budget = +m[1];
    e.cheap = /cheap|cheapest|lowest|budget|afford|least expensive|inexpensive/.test(t);

    const scored = INTENTS.map((it) => ({ it, score: it.kw.reduce((s, r) => s + (r.test(t) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (a.it.priority ?? 9) - (b.it.priority ?? 9));

    if (e.cars.length === 1) ctx.car = e.cars[0];
    ["days", "months", "frequency"].forEach((k) => { if (e[k] != null) ctx[k] = e[k]; });
    return { t, e, intents: scored.map((x) => x.it.id) };
  }

  const INTENTS = [
    { id: "greet", priority: 20, kw: [/\b(hi|hello|hey|yo|hiya|good (morning|afternoon|evening))\b/] },
    { id: "thanks", priority: 20, kw: [/\b(thanks|thank you|thx|ty|appreciate|awesome|perfect)\b/] },
    { id: "bye", priority: 20, kw: [/\b(bye|goodbye|see ya|see you|that'?s all)\b/] },
    { id: "rideshare", priority: 1, kw: [/uber|lyft|doordash|door dash|instacart|grubhub|gig|rideshare|ride share|deliver(y|ies) (job|work|app)/] },
    { id: "monthly", priority: 1, kw: [/monthly|per month|a month|each month/] },
    { id: "whyweek", priority: 1, kw: [/why .*(week|rent first)|have to rent|first week|try (it|the car) (first|out)/] },
    { id: "about", priority: 1, kw: [/how many trips|trips|reviews?|rating|stars|turo|who (are|is) (you|churo)|about (you|churo)|trust/] },
    { id: "deposit", priority: 1, kw: [/deposit|security|hold\b|refundable/] },
    { id: "maintenance", priority: 1, kw: [/maintenance|oil change|repairs?|tires?|who fixes/] },
    { id: "rto", priority: 1, kw: [/rent[- ]?to[- ]?own|\brto\b|lease[- ]to[- ]own|\bown (it|the car|a car)\b|ownership|finance|financing|payment plan|installments?/] },
    { id: "credit", priority: 1, kw: [/credit (check|score)|bad credit|no credit|my credit/] },
    { id: "down", priority: 2, kw: [/down ?payment|\bdown\b/] },
    { id: "cash", priority: 2, kw: [/\bbuy\b|purchase|for sale|sell|selling|\bcash\b|outright|title|\bdmv\b|registration|plates?/] },
    { id: "signing", priority: 2, kw: [/midflorida|notar|\bsign(ing)?\b|agreement|contract|paperwork/] },
    { id: "price", priority: 3, kw: [/how much|price|cost|rates?\b|\$|per day|per week|daily|weekly|total/] },
    { id: "rent", priority: 4, kw: [/\brent(al|ing)?\b|\bbook(ing)?\b|reserve|reservation/] },
    { id: "available", priority: 3, kw: [/availab|in stock|do you have|still have|taken|spoken for/] },
    { id: "fleet", priority: 4, kw: [/what (cars|vehicles)|which (cars|vehicles)|your (fleet|cars|vehicles)|show me|list|options/] },
    { id: "recommend", priority: 4, kw: [/recommend|suggest|best|which (one|car) should|good for|need a car/] },
    { id: "age", priority: 2, kw: [/i'?m \d{2}\b|i am \d{2}\b/, /\bage\b|how old|years? old|under 2[15]|young driver|minimum age/] },
    { id: "documents", priority: 2, kw: [/licen[cs]e|documents?|what (do i|should i) (need|bring)|requirements?|\bid\b|proof of (address|residence)|utility bill|paystub/] },
    { id: "insurance", priority: 0, kw: [/insurance|coverage|insured|accident|damage/] },
    { id: "delivery", priority: 2, kw: [/deliver|drop (it )?off|bring (it|the car)|airport|pick ?up|where (are you|do i)|location|located|address|zip/] },
    { id: "travel", priority: 1, kw: [/orlando|miami|tampa|jacksonville|key west|out of state|outside (of )?(fl|florida)|georgia|alabama|another state|road ?trip|where can i (drive|go|take)|take (it|the car) to|drive (it )?to|gps|tracker/] },
    { id: "mileage", priority: 1, kw: [/mile|mileage|unlimited|how far/] },
    { id: "clean", priority: 1, kw: [/clean|sanitiz|smell|dirty|inspect|damage photos|pre-?trip|post-?trip|condition/] },
    { id: "howbook", priority: 1, kw: [/how (do|can) i (book|reserve)|ready to book|make a (booking|reservation)|reserve (a|the|it)/] },
    { id: "oneway", priority: 2, kw: [/one[- ]way/] },
    { id: "extend", priority: 2, kw: [/extend|extension|keep (it|the car) longer|more days/] },
    { id: "cancel", priority: 2, kw: [/cancel|refund/] },
    { id: "issues", priority: 2, kw: [/broke ?down|problem|issue|flat tire|emergency|warning light/] },
    { id: "payment", priority: 3, kw: [/pay (with|by)|credit card|debit|zelle|cash app|venmo|chime|apple pay|payment method|how (do|can) i pay/] },
    { id: "contact", priority: 3, kw: [/contact|phone|call|text|email|talk to|human|person|owner|freeman/] },
  ];

  /* =======================================================
     Built-in responses
     ======================================================= */
  const carLine = (c) => `**${C.carName(c)}** (${c.color}) — **$${c.weekly}/week** (save ${c.weeklySavingsPct}%) · $${c.daily}/day`;
  const availCars = () => C.fleet.filter(C.rtoAvailable);

  function rtoText(car, ctx) {
    if (!C.rtoAvailable(car)) {
      const alts = availCars().filter((c) => c.type === car.type).slice(0, 3);
      return { text: `The **${C.carName(car)}** (${car.color}) is currently being purchased by another customer through Rent-to-Own, so it isn't available. 🙏\n\nSimilar ${car.type === "SUV" ? "SUVs" : "sedans"} you *can* rent-to-own:\n${alts.map((c) => `- **${C.carName(c)}** (${c.color}): ${money(c.down, false)} down`).join("\n")}`, cars: alts };
    }
    const maxM = C.rtoMaxMonths(car);
    const months = Math.min(ctx.months || maxM, maxM), freq = ctx.frequency || "weekly";
    const insurance = ctx.insurance || "own";
    const q = C.rtoQuote({ carId: car.id, months, frequency: freq, insurance });
    const other = C.rtoQuote({ carId: car.id, months, frequency: freq, insurance: insurance === "own" ? "churo" : "own" });
    const per = freq === "weekly" ? "per week" : "every 2 weeks";
    let text = `✅ The **${C.carName(car)}** (${car.color}) is available for Rent-to-Own. No credit check.\n` +
      `1. Rent it for one week first: **${money(q.firstWeek, false)}** (a normal weekly rental)\n` +
      `2. If you want to continue, bring the **${money(car.down, false)} down payment** to the signing at MIDFLORIDA\n` +
      `3. Then **${money(q.payment)} ${per}** for ${months} month${months > 1 ? "s" : ""}: ${money(q.carPayment)} car + ${money(q.insurancePer)} ${insurance === "own" ? "liability coverage (your own policy)" : "CHURO insurance"}\n` +
      `- With ${insurance === "own" ? "CHURO's insurance" : "your own policy"} instead: ${money(other.payment)} ${per}\n` +
      `- Total cost of the car: about **${money(q.carTotal, false)}** (price ${money(car.value, false)} + 8% APR + week-1 rental)`;
    if ((ctx.months || 0) > maxM) text += `\n\nNote: the shortest payment for this car is ${money(C.minWeekly(car), false)}/week, so the longest term is **${maxM} months**.`;
    text += `\n\nI've loaded it into the payment calculator so you can adjust it.`;
    return { text, cars: [car], action: () => window.ChuroApp && window.ChuroApp.selectRto(car.id, { months, frequency: freq }) };
  }

  function recommend(e) {
    let list = availCars();
    if (e.type) list = list.filter((c) => c.type === e.type);
    if (e.budget) list = list.filter((c) => c.weekly <= e.budget || c.daily <= e.budget || c.down <= e.budget);
    list.sort((a, b) => (e.cheap ? a.weekly - b.weekly : b.year - a.year));
    return list.slice(0, 3);
  }

  const R = {
    greet: () => pick(["Hey there! 👋 I'm **Churo**, CHURO Car Rentals' assistant.", "Hi! 👋 Welcome to CHURO."]) + " I can help you **rent**, **rent-to-own** (no credit check) or **buy** a car. What are you looking for?",
    thanks: () => pick(["Anytime! 🙌 Anything else?", "You got it! Ready to book? Tap **Book now** at the top.", "Happy to help, and enjoy the ride! 🚗"]),
    bye: () => "Take care! 🌴 I'm here whenever you need a ride.",
    rto: () => `**Rent-to-Own**: a low-stakes way into car ownership. No credit check.\n1. Rent the car for at least **1 week** to get a feel for it\n2. Meet at **MIDFLORIDA** to sign and notarize the agreement, pay the down payment and show proof of insurance (ours for $60/week, or yours + $97/month liability)\n3. Pay **weekly or every 2 weeks** until it's paid off (12 months max, no monthly plans)\n4. You handle routine maintenance, and the car is yours\n\nAvailable right now:\n${availCars().map((c) => `- **${C.carName(c)}** (${c.color}): ${money(c.down, false)} down`).join("\n")}\n\nWhich one interests you? I'll work out the payments.`,
    credit: () => "**No credit check!** 🙌 Rent-to-Own only requires that you rent the car for at least one week first, then make the down payment and show proof of insurance at signing.",
    down: () => `Down payments for Rent-to-Own (paid at signing, after your first week's rental):\n${availCars().sort((a, b) => a.down - b.down).map((c) => `- **${C.carName(c)}** (${c.color}): ${money(c.down, false)}`).join("\n")}`,
    cash: () => `Yes, you can **buy outright with cash**. ${P.cash.replace(/^Buy outright with cash: b/, "B")}\n\nCars for sale:\n${availCars().sort((a, b) => a.value - b.value).map((c) => `- **${C.carName(c)}** (${c.color}): **${money(c.value, false)}**`).join("\n")}`,
    signing: () => "Rent-to-Own agreements are signed and **notarized at MIDFLORIDA**. At signing you make the down payment and show proof of insurance (your own policy or ours).",
    maintenance: () => "For **rentals**, we handle all the maintenance. 🧰 With **Rent-to-Own**, you take over ongoing maintenance, just like an owner. Anything you find during your first-week rental, we fix before signing.",
    age: () => P.age,
    documents: () => `**To rent, you'll need:**\n- A valid **Florida** driver's license\n- Proof of address: at least **2 different recent documents in your name** (utility bill: electricity, water, internet or phone; paystub; or bank statement)\n- Your auto insurance card (optional)\n\n**Deposit (daily rentals):** just **$200** with 2 proofs of address; without them it's up to **$1,000**, depending on the car. Refunded at the end minus citations, tolls or fees.\n\n**Payment:** ${P.payment}\n\nFor Rent-to-Own you'll also need proof of insurance at signing.`,
    deposit: () => `${P.deposit}\n\nDeposit without proofs of address:\n${C.depositList().map((x) => `- ${x}`).join("\n")}`,
    about: () => `CHURO is a family-operated rental business in Sarasota. We've completed **${C.company.turoTrips} trips on Turo** with a **${C.company.rating}★ rating**, and now rent directly to you: no middlemen, no surprises. ⭐`,
    insurance: () => `**Rentals:** ask about coverage when you book.\n\n**Rent-to-Own:** ${P.rtoInsurance}`,
    rideshare: () => `${P.rideshare} [💬 Text us](#text) to ask.`,
    monthly: () => "We don't offer monthly payment plans. Rent-to-Own payments are **weekly or every two weeks**, as low as **$175/week** depending on the car (most cars have a $300/week minimum). Want me to work out a car for you?",
    whyweek: () => "Since there's **no credit check**, the one-week rental shows you can make payments on time. It also lets you get a feel for the car **before** committing. If you notice anything that needs fixing that week, tell us and we'll fix it **before** we sign at MIDFLORIDA.",
    delivery: () => `${P.pickup} Pick-up details are confirmed when you book. Questions? [📞 Call us](#call) or [💬 Text us](#text).`,
    travel: () => `🗺️ ${P.travel} ${P.mileage}`,
    mileage: () => `${P.mileage} ${P.travel}`,
    clean: () => `✨ ${P.cleanliness}`,
    howbook: () => `${P.booking.replace("Book now", "**Book now**").replace("Call us or Text us", "[📞 Call us](#call) or [💬 Text us](#text)")}\n\nFirst time renting with us? Complete the [renter assessment](#assessment) first.`,
    oneway: () => P.oneWay,
    extend: () => P.extend,
    cancel: () => P.cancellation,
    issues: () => P.issues,
    payment: () => P.payment + " Rent-to-Own down payments are made at signing.",
    contact: () => `[📞 Call us](#call) or [💬 Text us](#text) for any questions, or use the **Contact us** form. When you're ready to book, use **Book now**. It notifies us right away.`,
    fleet: () => `Here's the fleet (weekly rentals are deeply discounted):\n${C.fleet.filter(C.rtoAvailable).map((c) => `- ${carLine(c)}`).join("\n")}${C.fleet.some((c) => c.status === "soon") ? `\n\nComing soon: ${C.fleet.filter((c) => c.status === "soon").map((c) => `**${C.carName(c)}** ($${c.weekly}/week)`).join(", ")}` : ""}\n\nPlus ${C.fleet.filter((c) => c.status === "rto").length} more cars currently being purchased through Rent-to-Own.`,
  };

  function builtinReply(text, ctx) {
    const a = analyze(text, ctx);
    const e = a.e;
    const SMALL = ["greet", "thanks", "bye"];
    const small = a.intents.find((i) => SMALL.includes(i));
    const top = a.intents.find((i) => !SMALL.includes(i));
    const pending = !top && e.cars.length === 1 && ctx.pending;
    const has = (i) => a.intents.includes(i) || i === pending;
    ctx.candidates = null; ctx.pending = null;
    const res = { cars: null, chips: null, action: null, facts: [] };
    const out = (r) => { if (small === "greet" && r.text && top) r.text = "Hi there! 👋 " + r.text; if (r.text) r.facts.push(r.text); return r; };

    const INFO = ["travel", "mileage", "clean", "howbook", "delivery", "about", "deposit", "whyweek", "rideshare", "monthly", "maintenance", "insurance", "documents", "payment", "signing", "age", "oneway", "extend", "cancel", "issues", "contact"];
    const insFollowUp = /what if|instead|use (your|my|mine|yours)|with (your|my) insurance/.test(e.raw) && ctx.car && C.rtoAvailable(C.byId(ctx.car));
    if (INFO.includes(top) && !insFollowUp && !(e.cars.length === 1 && (has("rto") || has("cash") || has("price")))) {
      res.text = R[top](e, ctx);
      const second = a.intents.find((i) => i !== top && INFO.includes(i) && R[i]);
      if (second) res.text += "\n\n" + R[second](e, ctx);
      return out(res);
    }
    if (insFollowUp && !e.cars.length) { Object.assign(res, rtoText(C.byId(ctx.car), ctx)); return out(res); }

    // which car are we talking about? (explicit match, or the one from earlier in the chat)
    const refersBack = /\b(it|that|this|that one|this one|the car|same)\b/.test(e.raw) || e.months || e.frequency || e.days;
    const general = e.cheap || e.type || e.budget || /\b(cars|payments|all|any|which|list)\b/.test(e.raw) || has("maintenance");
    const car = e.cars.length === 1 ? C.byId(e.cars[0])
      : (!e.cars.length && ctx.car && refersBack && !general && (has("rto") || has("price") || has("cash") || has("down") || has("available") || has("rent") || e.months || e.frequency) ? C.byId(ctx.car) : null);

    // ambiguous model ("the Optima") → ask which one
    if (e.cars.length > 1 && (has("rto") || has("price") || has("cash") || has("available") || has("down") || !top)) {
      const cars = e.cars.map(C.byId);
      res.text = `We have ${cars.length} of those:\n${cars.map((c) => `- **${C.carName(c)}** (${c.color}): ${c.status === "available" ? `available · ${money(c.down, false)} RTO down · ${money(c.value, false)} cash` : "on Rent-to-Own (not available)"}`).join("\n")}\n\nWhich one? (e.g. "the ${cars[0].year} ${cars[0].color.toLowerCase()} one")`;
      res.cars = cars;
      ctx.candidates = e.cars;
      ctx.pending = ["rto", "cash", "down", "price"].find(has) || null;
      return out(res);
    }

    // ---- coming-soon car
    if (car && car.status === "soon") {
      res.text = `⚡ The **${C.carName(car)}** (${car.color}) is **coming soon**! It'll rent for **$${car.weekly}/week** or $${car.daily}/day. ${car.blurb}${car.features ? `\n\nFeatures: ${car.features.join(", ")}.` : ""}\n\nIt isn't bookable yet. Use the **Contact us** form to be first in line. Rent-to-Own and purchase details will be announced when it arrives.`;
      res.cars = [car];
      return out(res);
    }

    // ---- Rent-to-Own for a specific car (or payment questions with car context)
    if (car && (has("rto") || has("down") || has("credit") || ((e.months || e.frequency || /insurance|yours|my own/.test(e.raw)) && !has("rent") && !has("cash")))) {
      Object.assign(res, rtoText(car, ctx));
      if (has("credit")) res.text = "No credit check needed! 🙌\n\n" + res.text;
      return out(res);
    }

    // ---- cash price for a car
    if (car && has("cash")) {
      res.text = C.rtoAvailable(car)
        ? `The **${C.carName(car)}** (${car.color}) is for sale at **${money(car.value, false)} cash**. Pay in full, we sign the clean title over, and you register it at the DMV.\n\nPrefer payments? Rent-to-Own is **${money(car.down, false)} down** + from **${money(C.rtoQuote({ carId: car.id }).carPayment)}/week** (plus insurance), no credit check.`
        : `The **${C.carName(car)}** is currently being purchased through Rent-to-Own, so it's not for sale. Cars for sale: ${availCars().map((c) => `${C.carName(c)} (${money(c.value, false)})`).join(", ")}.`;
      res.cars = [car];
      return out(res);
    }

    // ---- rental price for a car
    if (car && (has("price") || has("rent") || has("available") || !top)) {
      if (!C.rtoAvailable(car)) {
        Object.assign(res, rtoText(car, ctx));
        res.text = res.text.replace("isn't available right now", "isn't available to rent or buy right now");
        return out(res);
      }
      const days = e.days || (e.cars.length ? null : ctx.days);
      let s = `**${C.carName(car)}** (${car.color}${car.seats ? `, ${car.seats} seats` : ""}): **$${car.weekly}/week** (saves ${car.weeklySavingsPct}% vs. daily) or $${car.daily}/day. ${car.blurb}${car.features ? `\n\nFeatures: ${car.features.join(", ")}.` : ""}`;
      if (days) {
        const q = C.rentalQuote(car.id, days);
        s += `\n\nFor **${days} days**: about **${money(q.total)}**${q.savings > 0 ? ` (you save ${money(q.savings, false)} with weekly pricing)` : ""}, before taxes.`;
        if (days < 7) s += ` Refundable deposit: **$200** with 2 proofs of address, otherwise **${money(C.depositDaily(car, false), false)}**.`;
      }
      s += `\n\nIt's also available for Rent-to-Own (${money(car.down, false)} down) or ${money(car.value, false)} cash. Tap **Book now** to reserve.`;
      res.text = s;
      res.cars = [car];
      res.chips = [`Rent-to-own the ${car.year} ${car.color.toLowerCase()} ${car.model}`, "Price for 1 week", "What do I need to rent?"];
      return out(res);
    }

    // ---- recommendations
    if (top === "recommend" || ((e.type || e.budget || e.cheap) && (!top || ["price", "rent", "fleet", "available", "rto"].includes(top)))) {
      const cars = recommend(e);
      if (cars.length) {
        res.text = `${e.type ? `Our available ${e.type === "SUV" ? "SUVs" : "sedans"}` : "Here's what I'd suggest"}${e.cheap ? ", cheapest first" : ""}:\n${cars.map((c, i) => `${i + 1}. ${carLine(c)} · RTO ${money(c.down, false)} down`).join("\n")}`;
        res.cars = cars;
      } else {
        res.text = "Nothing available matches that exactly right now. Here are our most affordable options:";
        res.cars = availCars().sort((x, y) => x.weekly - y.weekly).slice(0, 3);
      }
      return out(res);
    }

    // ---- general topic answers
    if (top && R[top]) {
      res.text = R[top](e, ctx);
      const second = a.intents.find((i) => i !== top && !SMALL.includes(i) && R[i] && !["price", "rent", "fleet", "available", "rto"].includes(i));
      if (second) res.text += "\n\n" + R[second](e, ctx);
      if (top === "fleet") res.cars = availCars();
      if (top === "rto") res.chips = availCars().slice(0, 3).map((c) => `RTO payments on the ${c.year} ${c.color.toLowerCase()} ${c.model}`);
      return out(res);
    }

    if (top === "price" || top === "rent" || top === "available") {
      // A generic listing is only a guess when the question has more to it than "what's available?".
      const words = e.raw.trim().split(/\s+/).length;
      if (words > 5 && !/what cars|which cars|list|show|options|price|how much|cheap/.test(e.raw)) res.soft = true;
      const cheapest = availCars().reduce((m, c) => (c.weekly < m.weekly ? c : m));
      res.text = `Rentals start at **$${cheapest.daily}/day** or **$${cheapest.weekly}/week** (${C.carName(cheapest)}). Weekly rentals are deeply discounted.\n\nAvailable now:\n${availCars().map((c) => `- ${carLine(c)}`).join("\n")}`;
      res.cars = availCars();
      return out(res);
    }

    if (small) { res.text = R[small](); res.chips = DEFAULT_CHIPS; return res; }

    res.fallback = true;
    res.text = `I'm not 100% sure about that one. 🤔 I can help with **rentals**, **Rent-to-Own** (no credit check), **buying with cash**, prices and requirements. For anything else, [📞 Call us](#call) or [💬 Text us](#text).`;
    res.chips = ["What cars are available?", "How does rent-to-own work?", "Cars for sale", "What do I need to rent?"];
    return res;
  }

  /* =======================================================
     Engines
     ======================================================= */
  const engines = {
    builtin: { label: "Built-in assistant · offline", ready: true },
    ollama: { label: "", ready: false, model: null },
    webllm: { label: "", ready: false, engine: null, loading: false },
  };

  async function detectOllama() {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`${CONFIG.ollamaUrl}/api/tags`, { signal: ctrl.signal });
      const data = await r.json();
      const names = (data.models || []).map((m) => m.name);
      if (!names.length) { engines.ollama.ready = false; engines.ollama.error = "Ollama is running but has no models. Run: ollama pull " + settings.ollamaModel; return false; }
      const wanted = settings.ollamaModel;
      engines.ollama.model = names.find((n) => n === wanted || n.split(":")[0] === wanted.split(":")[0]) || names[0];
      engines.ollama.ready = true;
      engines.ollama.label = `Local AI · ${engines.ollama.model} (Ollama)`;
      // Warm-up: load the model into memory now (empty prompt) and keep it there,
      // so the first real question doesn't wait for a cold start.
      // Warm-up also reads the system prompt once so Ollama caches it.
      fetch(`${CONFIG.ollamaUrl}/api/chat`, { method: "POST", body: JSON.stringify({
        model: engines.ollama.model, stream: false, keep_alive: "30m",
        messages: [{ role: "system", content: buildSystemPrompt() }, { role: "user", content: "hi" }],
        options: { temperature: 0.2, num_ctx: 8192, num_predict: 1 },
      }) }).catch(() => {});
      return true;
    } catch {
      engines.ollama.ready = false;
      engines.ollama.error = "Ollama not detected at " + CONFIG.ollamaUrl;
      return false;
    } finally { clearTimeout(to); }
  }

  async function* streamOllama(messages, signal) {
    const r = await fetch(`${CONFIG.ollamaUrl}/api/chat`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: engines.ollama.model, messages, stream: true, keep_alive: "30m", options: { temperature: 0.2, num_ctx: 8192, num_predict: 110 } }),
    });
    if (!r.ok || !r.body) throw new Error("Ollama HTTP " + r.status);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const j = JSON.parse(line);
        if (j.error) throw new Error(j.error);
        if (j.message && j.message.content) yield j.message.content;
      }
    }
  }

  async function loadWebLLM() {
    const W = engines.webllm;
    if (W.ready || W.loading) return W.ready;
    if (!("gpu" in navigator)) {
      W.error = "WebGPU isn't available in this browser. Try the latest Chrome or Edge on desktop.";
      return false;
    }
    W.loading = true;
    const prog = $("#webllmProgress");
    prog.hidden = false;
    setStatus("loading", "Downloading in-browser model…");
    try {
      // Use the 16-bit build when the GPU supports it, otherwise the 32-bit build.
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("no compatible graphics adapter (WebGPU) found");
      // Older Intel graphics produce garbage with 16-bit math, so they get the 32-bit build too.
      const isIntel = /intel/i.test((adapter.info && adapter.info.vendor) || "");
      const modelId = adapter.features.has("shader-f16") && !isIntel ? CONFIG.webllmModel : CONFIG.webllmModel.replace("q4f16_1", "q4f32_1");
      const webllm = await import(CONFIG.webllmCdn);
      W.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (p) => {
          prog.querySelector(".progress__bar").style.width = Math.round((p.progress || 0) * 100) + "%";
          prog.querySelector("span").textContent = p.text || "Loading…";
        },
      });
      W.ready = true;
      W.label = `In-browser AI · ${modelId.split("-q")[0]}`;
      prog.hidden = true;
      return true;
    } catch (err) {
      W.error = "Couldn't load the in-browser model: " + err.message;
      prog.hidden = true;
      return false;
    } finally { W.loading = false; }
  }

  async function* streamWebLLM(messages) {
    const chunks = await engines.webllm.engine.chat.completions.create({ messages, stream: true, temperature: 0.2, max_tokens: 110 });
    for await (const c of chunks) {
      const d = c.choices[0] && c.choices[0].delta && c.choices[0].delta.content;
      if (d) yield d;
    }
  }

  /** Which engine answers right now? */
  function activeEngine() {
    const s = settings.engine;
    if (s === "builtin") return "builtin";
    if (s === "webllm") return engines.webllm.ready ? "webllm" : "builtin";
    if (s === "ollama") return engines.ollama.ready ? "ollama" : "builtin";
    return IS_LOCAL_SITE && engines.ollama.ready ? "ollama" : "builtin"; // auto
  }

  /* =======================================================
     UI
     ======================================================= */
  const ui = {
    chat: $("#chat"), body: $("#chatBody"), chips: $("#chatChips"), form: $("#chatForm"),
    input: $("#chatInput"), send: $("#chatSend"), launcher: $("#chatLauncher"), badge: $("#chatBadge"),
    settings: $("#chatSettings"), dot: $("#engineDot"), label: $("#engineLabel"),
  };
  const settings = { engine: "auto", ollamaModel: CONFIG.ollamaModel, ...store.get(STORE.settings, {}) };
  let history = store.get(STORE.chat, []); // [{role, content, cars?}]
  const ctx = {}; // conversation memory (car, days, age, location, dates)
  let busy = false;

  const DEFAULT_CHIPS = ["What cars are available?", "How does rent-to-own work?", "Is there a credit check?", "Cheapest weekly rental?", "Cars for sale", "Need a 7-seater SUV"];

  function setStatus(kind, text) {
    ui.dot.className = kind === "on" ? "on" : kind === "loading" ? "loading" : "";
    ui.label.textContent = text;
  }
  function refreshStatus() {
    const id = activeEngine();
    if (id === "builtin") {
      const why = settings.engine === "ollama" ? engines.ollama.error : settings.engine === "webllm" ? engines.webllm.error : "";
      setStatus("on", engines.builtin.label + (why ? " — fallback" : ""));
    } else setStatus("on", engines[id].label);
  }

  function scrollDown() { ui.body.scrollTop = ui.body.scrollHeight; }

  function addBubble(role, content) {
    const div = document.createElement("div");
    div.className = `msg msg--${role === "user" ? "user" : "bot"}`;
    div.innerHTML = role === "user" ? esc(content).replace(/\n/g, "<br>") : md(content);
    ui.body.appendChild(div);
    scrollDown();
    return div;
  }

  function addCars(ids) {
    const wrap = document.createElement("div");
    wrap.className = "chat-cars";
    ids.map(C.byId).filter(Boolean).forEach((c) => {
      const avail = C.rtoAvailable(c);
      wrap.insertAdjacentHTML("beforeend", `
        <div class="chat-car">
          <img src="${c.photos[0]}" alt="${esc(C.carName(c))}" loading="lazy" />
          <div><strong>${esc(C.carName(c))}</strong><small>${esc(c.color)} · $${c.daily}/day · $${c.weekly}/wk</small>
          <small>${avail ? `<b>Available</b> · RTO ${money(c.down, false)} down` : c.status === "soon" ? "<b>Coming soon</b>" : "Rent-to-Own in progress"}</small>
          ${avail ? `<button data-chat-rto="${c.id}">Rent-to-Own payments</button>` : ""}</div>
        </div>`);
    });
    ui.body.appendChild(wrap);
    scrollDown();
  }

  function setChips(list) {
    ui.chips.innerHTML = "";
    (list || DEFAULT_CHIPS).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => send(c));
      ui.chips.appendChild(b);
    });
  }

  function typing() {
    const d = document.createElement("div");
    d.className = "msg msg--bot typing";
    d.innerHTML = "<i></i><i></i><i></i>";
    ui.body.appendChild(d);
    scrollDown();
    return d;
  }

  function persist() { store.set(STORE.chat, history.slice(-40)); }

  function renderHistory() {
    ui.body.innerHTML = "";
    if (!history.length) greet();
    else history.forEach((m) => { addBubble(m.role, m.content); if (m.cars && m.cars.length) addCars(m.cars); });
    setChips();
  }

  function greet() {
    const hour = new Date().getHours();
    const hi = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const text = `${hi}! 👋 I'm **Churo**, CHURO Car Rentals' assistant.\n\nI can help you **rent** a car, work out **Rent-to-Own** payments (no credit check), or find a car to **buy with cash**. What are you looking for?`;
    history.push({ role: "assistant", content: text });
    addBubble("assistant", text);
    persist();
  }

  /** Guardrail for LLM replies: reject customer-voice replies and dollar amounts we never gave it. */
  function replyLooksSafe(reply, sourceText) {
    if (/\b(\w+)(?:\W+\1\b){5,}/i.test(reply)) return false; // degenerate repetition ("breaks breaks breaks…")
    if (/\b(i'?m interested in|can you help me|i'?d like to (know|rent|buy)|i want to (rent|buy|know)|i would like to)\b/i.test(reply)) return false;
    const norm = (m) => m.replace(/[$,\s]/g, "").replace(/\.00$/, "");
    const allowed = new Set((sourceText.match(/\$\s?\d[\d,]*(\.\d+)?/g) || []).map(norm));
    const used = (reply.match(/\$\s?\d[\d,]*(\.\d+)?/g) || []).map(norm);
    return used.every((m) => allowed.has(m));
  }

  /* ---------- send / respond ---------- */
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    ui.send.disabled = true;
    ui.input.value = "";
    autosize();
    history.push({ role: "user", content: text });
    addBubble("user", text);
    persist();

    const local = builtinReply(text, ctx);
    const engineId = activeEngine();
    const t = typing();
    let reply = "";

    try {
      // Hybrid: verified built-in answers are instant and exact, so use them whenever we have one.
      // The AI model only handles questions the built-in assistant can't answer.
      if (engineId === "builtin" || local.handled || !(local.fallback || local.soft)) {
        await new Promise((r) => setTimeout(r, 250 + Math.min(350, local.text.length * 1.5)));
        t.remove();
        reply = local.text;
        addBubble("assistant", reply);
      } else {
        // LLM path: pass grounded facts computed by the analyzer.
        // Verified answer goes into the system prompt (never into the customer's message,
        // or small models start replying as the customer).
        const sys = buildSystemPrompt() + (local.facts.length && !local.fallback
          ? `\n\nVERIFIED ANSWER to the customer's latest message (written by CHURO, in CHURO's voice). Rephrase it naturally for the customer; keep all numbers exactly:\n"""\n${local.facts.join("\n")}\n"""`
          : "");
        const msgs = [{ role: "system", content: sys }];
        const past = history.slice(-CONFIG.maxHistory - 1, -1);
        while (past.length && past[0].role !== "user") past.shift();
        past.forEach((m) => msgs.push({ role: m.role, content: m.content }));
        msgs.push({ role: "user", content: text });

        // Hard time limit: slow hardware must never leave a customer waiting.
        const ctrl = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          ctrl.abort();
          if (engineId === "webllm" && engines.webllm.engine) engines.webllm.engine.interruptGenerate();
        }, CONFIG.llmTimeoutMs);
        const stream = engineId === "ollama" ? streamOllama(msgs, ctrl.signal) : streamWebLLM(msgs);
        let bubble = null;
        try {
          for await (const tok of stream) {
            if (timedOut) break;
            if (!bubble) { t.remove(); bubble = addBubble("assistant", ""); }
            reply += tok;
            bubble.innerHTML = md(reply);
            scrollDown();
          }
        } catch (err) {
          if (!timedOut) throw err;
        } finally { clearTimeout(timer); }
        if (timedOut) {
          console.warn("[Churo] AI took too long, showing built-in answer");
          reply = local.text;
          if (t.isConnected) t.remove();
          if (bubble) bubble.innerHTML = md(reply); else addBubble("assistant", reply);
        } else if (!bubble) { t.remove(); reply = local.text; addBubble("assistant", reply); }
        else if (!replyLooksSafe(reply, sys)) {
          // Role confusion or a number not in our data → show the verified answer instead.
          console.warn("[Churo] LLM reply rejected, using verified answer:", reply);
          reply = local.text;
          bubble.innerHTML = md(reply);
        }
      }
    } catch (err) {
      // Engine failed mid-conversation → graceful fallback.
      console.warn("[Churo] engine error, falling back:", err);
      if (t.isConnected) t.remove();
      if (engineId === "ollama") { engines.ollama.ready = false; refreshStatus(); }
      reply = local.text;
      addBubble("assistant", reply);
    }

    const cars = (local.cars || []).map((c) => c.id);
    if (cars.length) addCars(cars);
    history.push({ role: "assistant", content: reply, cars });
    persist();
    setChips(local.chips);
    if (local.action) setTimeout(local.action, 700);

    busy = false;
    ui.send.disabled = false;
    ui.input.focus();
  }

  /* ---------- events ---------- */
  function autosize() { ui.input.style.height = "auto"; ui.input.style.height = Math.min(ui.input.scrollHeight, 120) + "px"; }
  ui.input.addEventListener("input", autosize);
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ui.input.value); }
  });
  ui.form.addEventListener("submit", (e) => { e.preventDefault(); send(ui.input.value); });

  ui.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-chat-rto]");
    if (b && window.ChuroApp) { window.ChuroApp.selectRto(b.dataset.chatRto); if (window.innerWidth < 760) minimize(); }
  });

  function open() {
    ui.chat.hidden = false;
    ui.launcher.setAttribute("aria-expanded", "true");
    ui.badge.hidden = true;
    scrollDown();
    if (((settings.engine === "auto" && IS_LOCAL_SITE) || settings.engine === "ollama") && !engines.ollama.ready && !busy) detectOllama().then(refreshStatus);
    setTimeout(() => ui.input.focus(), 50);
  }
  function minimize() {
    ui.chat.hidden = true;
    ui.launcher.setAttribute("aria-expanded", "false");
  }
  ui.launcher.addEventListener("click", open);
  $("#chatCloseBtn").addEventListener("click", minimize);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ui.chat.hidden && !document.querySelector("dialog[open]")) minimize(); });

  $("#chatResetBtn").addEventListener("click", () => {
    history = [];
    Object.keys(ctx).forEach((k) => delete ctx[k]);
    persist();
    renderHistory();
  });

  $("#chatSettingsBtn").addEventListener("click", () => { ui.settings.hidden = !ui.settings.hidden; });

  // engine radios
  document.querySelectorAll('input[name="engine"]').forEach((r) => {
    r.checked = r.value === settings.engine;
    r.addEventListener("change", async () => {
      settings.engine = r.value;
      store.set(STORE.settings, settings);
      await applyEngine(true);
    });
  });
  const modelInput = $("#ollamaModel");
  modelInput.value = settings.ollamaModel;
  modelInput.addEventListener("change", async () => {
    settings.ollamaModel = modelInput.value.trim() || CONFIG.ollamaModel;
    store.set(STORE.settings, settings);
    await applyEngine(true);
  });

  async function applyEngine(announce) {
    setStatus("loading", "Connecting…");
    if ((settings.engine === "auto" && IS_LOCAL_SITE) || settings.engine === "ollama") await detectOllama();
    if (settings.engine === "webllm") await loadWebLLM();
    refreshStatus();
    if (!announce) return;
    const id = activeEngine();
    let note;
    if (settings.engine === "ollama" && id !== "ollama") note = `⚠️ ${engines.ollama.error}. Using the built-in assistant for now. See README for the 2-minute Ollama setup.`;
    else if (settings.engine === "webllm" && id !== "webllm") note = `⚠️ ${engines.webllm.error || "In-browser model not ready."} Using the built-in assistant.`;
    else note = `✅ Switched to **${engines[id].label}**.`;
    addBubble("assistant", note);
  }

  /* ---------- boot ---------- */
  renderHistory();
  applyEngine(false);
  if (location.hash === "#chat") open();

  window.ChuroChat = { _systemPrompt: buildSystemPrompt, open, minimize, send: (t) => { open(); send(t); }, _builtinReply: builtinReply, _analyze: analyze };
})();
