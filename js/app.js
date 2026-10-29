/* =========================================================
   CHURO — website logic
   Fleet tiles (with photo strips), rental estimates, Rent-to-Own
   calculator, cars for sale, FAQ. Exposes window.ChuroApp so the
   chatbot can drive the UI.
   ========================================================= */
(function () {
  const C = window.CHURO;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = C.money;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isoDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const state = { filter: "All", days: null };

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#burger"), navLinks = $("#navLinks");
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
    if (open) nav.classList.add("is-scrolled");
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    $("#moreMenu").classList.remove("is-open");
  }));
  const more = $("#moreMenu"), moreBtn = $(".more__btn");
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = more.classList.toggle("is-open");
    moreBtn.setAttribute("aria-expanded", open);
  });
  document.addEventListener("click", (e) => { if (!more.contains(e.target)) { more.classList.remove("is-open"); moreBtn.setAttribute("aria-expanded", "false"); } });

  /* ---------- Search / rental estimate ---------- */
  const startInp = $("#startDate"), endInp = $("#endDate");
  const today = new Date();
  startInp.min = isoDate(today);
  startInp.value = isoDate(addDays(today, 1));
  endInp.value = isoDate(addDays(today, 8));
  endInp.min = startInp.value;
  startInp.addEventListener("change", () => {
    endInp.min = startInp.value;
    if (endInp.value <= startInp.value) endInp.value = isoDate(addDays(new Date(startInp.value + "T12:00:00"), 7));
  });
  $("#search").addEventListener("submit", (e) => {
    e.preventDefault();
    const days = Math.round((new Date(endInp.value) - new Date(startInp.value)) / 86400000);
    const note = $("#searchNote");
    note.textContent = "";
    if (!(days >= 1)) { note.textContent = "Return date must be at least one day after pick-up."; return; }
    state.days = days;
    setFilter($("#typeSel").value);
    $("#fleet").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- Fleet ---------- */
  const FILTERS = [
    ["All", "All cars"],
    ["SUV", "SUVs"],
    ["Sedan", "Sedans"],
    ["RTO", "Rent-to-Own ready"],
  ];
  const filtersEl = $("#filters");
  FILTERS.forEach(([val, label]) => {
    const b = document.createElement("button");
    b.className = "chip" + (val === "All" ? " is-active" : "");
    b.textContent = label;
    b.dataset.filter = val;
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => setFilter(val));
    filtersEl.appendChild(b);
  });
  function setFilter(f) {
    state.filter = f;
    $$(".chip", filtersEl).forEach((b) => b.classList.toggle("is-active", b.dataset.filter === f));
    renderFleet();
  }

  function photoStrip(car) {
    const name = esc(C.carName(car));
    const imgs = car.photos.map((p, i) => `<img src="${p}" alt="${name}, photo ${i + 1}" loading="lazy" data-zoom="${car.id}" data-i="${i}" />`).join("");
    const thumbs = car.photos.length > 1
      ? `<div class="car__thumbs">${car.photos.slice(0, 3).map((p, i) => `<button type="button" data-thumb="${i}" class="${i === 0 ? "is-active" : ""}" aria-label="Show photo ${i + 1}"><img src="${p}" alt="" loading="lazy" /></button>`).join("")}</div>`
      : "";
    return { imgs, thumbs };
  }

  function renderFleet() {
    const grid = $("#fleetGrid");
    let cars = C.fleet.filter((c) =>
      state.filter === "All" || (state.filter === "RTO" ? C.rtoAvailable(c) : c.type === state.filter));
    const ORDER = { available: 0, soon: 1, rto: 2 };
    cars = cars.slice().sort((a, b) => (a.status === b.status ? b.year - a.year : ORDER[a.status] - ORDER[b.status]));

    $("#fleetLead").innerHTML = state.days
      ? `Estimated totals for <strong>${state.days} day${state.days > 1 ? "s" : ""}</strong>. Full weeks are billed at the discounted weekly rate.`
      : "Swipe a photo or tap the thumbnails to see more of each car. Prices shown per day and per week.";

    grid.innerHTML = cars.length ? "" : `<p class="empty">No cars match this filter.</p>`;
    cars.forEach((car, idx) => {
      const avail = car.status === "available";
      const rto = C.rtoQuote({ carId: car.id, frequency: "weekly" });
      const est = state.days ? C.rentalQuote(car.id, state.days) : null;
      const { imgs, thumbs } = photoStrip(car);
      const el = document.createElement("article");
      const soon = car.status === "soon";
      el.className = "car" + (avail || soon ? "" : " car--muted");
      el.style.animationDelay = `${idx * 50}ms`;
      el.innerHTML = `
        <div class="car__media">
          <div class="car__track">${imgs}</div>
          <div class="car__badges">
            <span class="car__tag">${esc(car.type)}</span>
            <span class="badge ${avail ? "badge--ok" : soon ? "badge--soon" : "badge--rto"}">${avail ? "Available" : soon ? "Coming soon" : "Rent-to-Own in progress"}</span>
          </div>
          ${car.photos.length > 1 ? `<span class="car__count">📷 ${car.photos.length}</span>` : ""}
        </div>
        ${thumbs}
        <div class="car__body">
          <div class="car__top">
            <h3 class="car__name">${esc(C.carName(car))}<small>${esc(car.color)}${car.seats ? ` · ${car.seats} seats` : ""}</small></h3>
            <div class="car__price"><strong>$${car.weekly}</strong><span>/week</span>
              <span class="daily">or $${car.daily}/day</span>
            </div>
          </div>
          ${est ? `<p class="car__note">${state.days} days: <b>${money(est.total)}</b>${est.savings > 0 ? ` · you save ${money(est.savings, false)} vs. daily` : ""} <small class="muted">(est., before taxes)</small>${state.days < 7 ? `<br><small>Refundable deposit: <b>$200</b> with 2 proofs of address, otherwise <b>${money(C.depositDaily(car, false), false)}</b>.</small>` : ""}</p>` : ""}
          ${avail || soon ? `<p class="car__deal">🔥 Weekly saves ${car.weeklySavingsPct}% vs. daily</p>` : ""}
          <p class="car__blurb">${esc(car.blurb)}</p>
          ${car.features ? `<ul class="car__features">${car.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
          ${avail
            ? `<p class="car__note">🔑 Rent-to-Own: <b>${money(car.down, false)} down</b>, then from <b>${money(rto.carPayment)}/week</b> + insurance. No credit check.</p>`
            : soon ? `<p class="car__note">⚡ Arriving soon at <b>$${car.weekly}/week</b>. Want to be first in line? Let us know.</p>`
            : `<p class="car__note">🎉 A CHURO customer is on their way to owning this one through Rent-to-Own. Like it? Ask us about a similar car.</p>`}
          <div class="car__actions">
            ${avail
              ? `<a class="btn btn--dark btn--sm" href="${C.company.bookingUrl}" target="_blank" rel="noopener">Book</a>
                 <button class="btn btn--ghost btn--sm" data-rto="${car.id}">Rent-to-Own</button>`
              : soon ? `<a class="btn btn--dark btn--sm" href="${C.company.contactUrl}" target="_blank" rel="noopener">Notify me</a>`
              : `<button class="btn btn--ghost btn--sm" data-ask="${car.id}">Ask about a similar car</button>`}
          </div>
        </div>`;
      grid.appendChild(el);

      // keep thumbnails in sync with swipes
      const track = $(".car__track", el);
      track.addEventListener("scroll", () => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        $$(".car__thumbs button", el).forEach((b, j) => b.classList.toggle("is-active", i === j));
      }, { passive: true });
    });
  }

  $("#fleetGrid").addEventListener("click", (e) => {
    const th = e.target.closest("[data-thumb]");
    if (th) {
      const track = $(".car__track", th.closest(".car"));
      track.scrollTo({ left: track.clientWidth * +th.dataset.thumb, behavior: "smooth" });
      return;
    }
    const z = e.target.closest("[data-zoom]");
    if (z) return openViewer(z.dataset.zoom, +z.dataset.i);
    const r = e.target.closest("[data-rto]");
    if (r) return selectRto(r.dataset.rto);
    const a = e.target.closest("[data-ask]");
    if (a && window.ChuroChat) {
      const car = C.byId(a.dataset.ask);
      window.ChuroChat.send(`Do you have something similar to the ${C.carName(car)} available?`);
    }
  });
  // hovering a thumbnail previews it (desktop)
  $("#fleetGrid").addEventListener("mouseover", (e) => {
    const th = e.target.closest("[data-thumb]");
    if (!th) return;
    const track = $(".car__track", th.closest(".car"));
    track.scrollTo({ left: track.clientWidth * +th.dataset.thumb, behavior: "smooth" });
  });

  /* ---------- Photo viewer ---------- */
  const viewer = $("#viewer");
  let vCar = null, vIdx = 0;
  function openViewer(carId, i = 0) {
    vCar = C.byId(carId); vIdx = i;
    showViewer();
    viewer.showModal();
  }
  function showViewer() {
    $("#viewerImg").src = vCar.photos[vIdx];
    $("#viewerImg").alt = C.carName(vCar);
    $("#viewerCap").textContent = `${C.carName(vCar)} · ${vCar.color}${vCar.photos.length > 1 ? ` · ${vIdx + 1}/${vCar.photos.length}` : ""}`;
  }
  $("#viewerImg").addEventListener("click", () => { vIdx = (vIdx + 1) % vCar.photos.length; showViewer(); });
  $("#viewerClose").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });

  /* ---------- Rent-to-Own calculator ---------- */
  const calcCar = $("#calcCar"), calcMonths = $("#calcMonths");
  const groups = [["Available for Rent-to-Own", (c) => C.rtoAvailable(c)], ["Currently on Rent-to-Own (not available)", (c) => c.status === "rto"]];
  groups.forEach(([label, test]) => {
    const og = document.createElement("optgroup");
    og.label = label;
    C.fleet.filter(test).sort((a, b) => a.value - b.value).forEach((c) => {
      og.appendChild(new Option(`${C.carName(c)} (${c.color}) · ${money(c.value, false)}`, c.id));
    });
    calcCar.appendChild(og);
  });
  calcCar.value = "sorento-2018-lx";

  function renderCalc() {
    const frequency = $("input[name=freq]:checked").value;
    const insurance = $("input[name=ins]:checked").value;
    const car = C.byId(calcCar.value);
    const maxM = C.rtoMaxMonths(car);
    calcMonths.max = maxM;
    if (+calcMonths.value > maxM) calcMonths.value = maxM;
    const months = +calcMonths.value;
    const q = C.rtoQuote({ carId: car.id, months, frequency, insurance });
    const per = frequency === "weekly" ? "week" : "2 weeks";
    $("#calcMonthsOut").textContent = months;
    $("#calcMaxNote").textContent = maxM < 12 ? `(max ${maxM} for this car, min payment ${money(C.minWeekly(car), false)}/wk)` : "(12 max)";
    calcMonths.setAttribute("aria-valuetext", `${months} months`);

    const avail = $("#calcAvail");
    avail.className = "calc__avail " + (q.available ? "ok" : "no");
    avail.innerHTML = q.available
      ? `✅ <b>${esc(C.carName(car))}</b> (${esc(car.color)}) is available for Rent-to-Own.`
      : `⏳ <b>${esc(C.carName(car))}</b> (${esc(car.color)}) is currently being purchased by another customer through Rent-to-Own, so it isn't available. The numbers show what a similar car would cost.`;

    $("#calcResult").classList.toggle("is-unavailable", !q.available);
    $("#calcPayLabel").textContent = frequency === "weekly" ? "Your weekly payment" : "Your bi-weekly payment";
    $("#calcPayment").textContent = money(q.payment);
    $("#calcSub").textContent = `${money(q.carPayment)} car + ${money(q.insurancePer)} insurance · ${q.n} payments · paid off around ${fmtDate(q.payoff)}`;

    const insLabel = insurance === "own"
      ? `Liability coverage ($${C.rto.ownInsuranceMonthly}/mo, per ${per})`
      : `CHURO insurance ($${C.rto.churoInsuranceWeekly}/wk, per ${per})`;
    const lines = [
      ["Car price", money(car.value, false)],
      ["<b>Step 1:</b> rent it for 1 week (paid as a normal rental)", money(q.firstWeek, false)],
      ["<b>Step 2:</b> down payment at signing (MIDFLORIDA)", money(car.down, false)],
      ["Amount financed", money(q.principal, false)],
      [`Interest (8% APR, ${months} mo)`, money(q.interest)],
      [`Car payment (per ${per})`, money(q.carPayment)],
      [insLabel, money(q.insurancePer)],
    ];
    $("#calcLines").innerHTML = lines.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join("") +
      `<li class="total"><span><b>Step 3:</b> your ${frequency === "weekly" ? "weekly" : "bi-weekly"} payment</span><span>${money(q.payment)}</span></li>` +
      `<li class="total"><span>Total paid for the car (incl. week-1 rental)</span><span>${money(q.carTotal)}</span></li>`;
    $("#calcInsNote").innerHTML = insurance === "own"
      ? "Using your own policy? List CHURO as <b>lienholder/loss payee</b> and <b>additional insured</b>. The car stays in CHURO's name until it's paid off, so Florida law requires us to keep minimum liability on it. That $97/month is passed through to you."
      : "CHURO's coverage is added at $60/week. Nothing else to set up.";

    const cta = $("#calcCta");
    cta.classList.toggle("is-disabled", !q.available);
    cta.textContent = q.available ? "Start with a 1-week rental" : "Not available right now";
  }
  [calcCar, calcMonths].forEach((el) => el.addEventListener("input", renderCalc));
  $$("input[name=freq], input[name=ins]").forEach((el) => el.addEventListener("change", renderCalc));

  function selectRto(carId, opts = {}) {
    if (C.byId(carId)) calcCar.value = carId;
    if (opts.months) calcMonths.value = Math.min(12, Math.max(1, opts.months));
    if (opts.frequency) { const r = $(`input[name=freq][value=${opts.frequency}]`); if (r) r.checked = true; }
    renderCalc();
    $("#calculator").scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Cars for sale ---------- */
  $("#saleGrid").innerHTML = C.fleet.filter(C.rtoAvailable).sort((a, b) => a.value - b.value).map((c) => {
    const q = C.rtoQuote({ carId: c.id, frequency: "weekly" });
    return `
      <article class="sale-card">
        <img src="${c.photos[0]}" alt="${esc(C.carName(c))}" loading="lazy" data-zoom-sale="${c.id}" />
        <div class="sale-card__body">
          <h3>${esc(C.carName(c))}</h3>
          <p class="muted" style="margin:0">${esc(c.color)} · ${esc(c.type)}</p>
          <div class="sale-card__price">${money(c.value, false)} <small class="muted" style="font-size:.9rem;font-family:var(--font-body)">cash</small></div>
          <p class="sale-card__alt">or Rent-to-Own: <b>${money(c.down, false)} down</b> + from ${money(q.carPayment)}/wk</p>
          <div class="sale-card__actions">
            <a class="btn btn--dark btn--sm" href="${C.company.contactUrl}" target="_blank" rel="noopener">I'm interested</a>
            <button class="btn btn--ghost btn--sm" data-rto="${c.id}">Payments</button>
          </div>
        </div>
      </article>`;
  }).join("");
  $("#saleGrid").addEventListener("click", (e) => {
    const z = e.target.closest("[data-zoom-sale]");
    if (z) return openViewer(z.dataset.zoomSale, 0);
    const r = e.target.closest("[data-rto]");
    if (r) selectRto(r.dataset.rto);
  });

  /* ---------- FAQ ---------- */
  const P = C.policies;
  const faq = [
    ["What is CHURO?", "CHURO is a family-operated car rental business in Sarasota, Florida. After 501+ trips and a 4.9-star rating on Turo, we now rent directly to you: no middlemen, no surprises."],
    ["How does Rent-to-Own work?", P.rto],
    ["Is there a credit check for Rent-to-Own?", "No credit check. Instead, every Rent-to-Own starts with a one-week rental. It shows you can make payments on time, and lets you get a feel for the car before committing. Anything you notice that needs fixing that week, tell us and we'll fix it before signing."],
    ["What insurance do I need for Rent-to-Own?", P.rtoInsurance],
    ["Can I drive for Uber, Lyft or DoorDash?", P.rideshare],
    ["Can I pay monthly?", "No. Rent-to-Own payments are weekly or every two weeks. Weekly payments can be as low as $175 depending on the car."],
    ["Who handles maintenance?", P.maintenance],
    ["Can I buy a car outright?", P.cash],
    ["Do you rent by the week?", P.rentals],
    ["How old do I need to be?", P.age],
    ["What do I need to rent?", P.documents],
    ["How can I pay?", P.payment],
    ["Is there a security deposit?", P.deposit + " Without proofs of address: " + C.depositList().join("; ") + "."],
    ["Where do I pick up the car? Do you deliver?", P.pickup],
    ["Where can I drive?", P.travel + " " + P.mileage],
    ["Are the cars clean and inspected?", P.cleanliness],
    ["Do I need to do anything before renting?", P.assessment, ["Take the renter assessment →", "renter-quiz/"]],
    ["How do I book?", P.booking],
    ["Can I do a one-way rental?", P.oneWay],
    ["How do I extend my rental?", P.extend],
  ];
  $("#faqList").innerHTML = faq.map(([q, a, link], i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}${link ? ` <a class="faq__link" href="${link[1]}">${esc(link[0])}</a>` : ""}</p></details>`).join("");

  /* ---------- misc ---------- */
  $("#year").textContent = new Date().getFullYear();
  $$("[data-open-chat]").forEach((b) => b.addEventListener("click", () => window.ChuroChat && window.ChuroChat.open()));

  renderFleet();
  renderCalc();

  window.ChuroApp = { selectRto, showFilter(f) { setFilter(f); $("#fleet").scrollIntoView({ behavior: "smooth" }); } };
})();
