/* =========================================================
   CHURO — business knowledge base
   Single source of truth for the website AND the chatbot.
   Update a car's status, prices or photos here and every
   tile, calculator and chatbot answer follows.

   status:
     "available" – can be rented, rented-to-own, or bought
     "soon"      – coming soon: shown with prices, not bookable yet
     "rto"       – being purchased by a customer through Rent-to-Own (not offered)

   Prices: a number, or a [min, max] range. Ranges resolve to one
   price per day (same for every visitor that day) and change daily.
   ========================================================= */

window.CHURO = {
  company: {
    name: "CHURO Car Rentals",
    tagline: "Fast. Easy. Available!",
    city: "Sarasota, FL 34234",
    turoTrips: "501+",
    rating: "4.9",
    // Booking + payment (Stripe is connected inside this Fillout form)
    bookingUrl: "https://forms.fillout.com/t/pHEsqVXHKaus",
    contactUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdDgjD5kFGaFIEEmNzoNym8B8v12XjKW2jX8AZsHEpCmtCb_Q/viewform?usp=sharing&ouid=115600938134616394240",
    signingPlace: "MIDFLORIDA",
  },

  // Rent-to-Own terms
  rto: {
    apr: 0.08,                 // annual interest on the amount financed
    maxMonths: 12,
    minWeeklyDefault: 300,     // minimum weekly car payment (bi-weekly = 2×)
    ownInsuranceMonthly: 97,   // FL minimum liability CHURO keeps on the car if the customer uses their own policy
    churoInsuranceWeekly: 60,  // customer uses CHURO's insurance
    firstWeekRequired: true,
  },

  fleet: [
    {
      id: "sorento-2022-lx", year: 2022, make: "Kia", model: "Sorento", trim: "LX", color: "Everlasting Silver",
      type: "SUV", seats: 7, daily: 175, weekly: 720, value: 29780, down: 5000, status: "available",
      photos: ["assets/cars/sorento-2022-lx-1.jpg", "assets/cars/sorento-2022-lx-2.jpg", "assets/cars/sorento-2022-lx-3.jpg"],
      blurb: "Our newest 7-seater. Third row folds flat when you need cargo space — perfect for families and groups.",
    },
    {
      id: "sorento-2018-sx", year: 2018, make: "Kia", model: "Sorento", trim: "SX", color: "White",
      type: "SUV", seats: 7, daily: 165, weekly: 650, value: 16991, down: 1500, status: "available",
      features: ["Top SX trim", "Panoramic sunroof", "Leather seats", "Memory seating", "Auto-folding mirrors", "Power liftgate"],
      photos: ["assets/cars/sorento-2018-sx-1.jpg", "assets/cars/sorento-2018-sx-2.jpg", "assets/cars/sorento-2018-sx-3.jpg"],
      blurb: "Kia's top trim for 2018 — loaded with comfort features and room for seven.",
    },
    {
      id: "sorento-2016-sx", year: 2016, make: "Kia", model: "Sorento", trim: "SX", color: "White",
      type: "SUV", seats: 7, daily: 145, weekly: 550, value: 15991, down: 1200, status: "available",
      features: ["Top SX trim", "Panoramic sunroof", "Leather seats", "Memory seating", "Auto-folding mirrors", "Power liftgate"],
      photos: ["assets/cars/sorento-2016-sx-1.jpg", "assets/cars/sorento-2016-sx-2.jpg", "assets/cars/sorento-2016-sx-3.jpg"],
      blurb: "Kia's top trim for 2016, with blacked-out wheels and a third row for the whole crew.",
    },
    {
      id: "sorento-2018-lx", year: 2018, make: "Kia", model: "Sorento", trim: "LX", color: "Black",
      type: "SUV", seats: 7, daily: 130, weekly: 510, value: 15991, down: 1200, status: "available",
      photos: ["assets/cars/sorento-2018-lx-1.jpg", "assets/cars/sorento-2018-lx-2.jpg", "assets/cars/sorento-2018-lx-3.jpg"],
      blurb: "Sleek in black, comfortable and roomy — a smart pick for airport runs and weekend getaways.",
    },
    {
      id: "sorento-2016-lx", year: 2016, make: "Kia", model: "Sorento", trim: "LX", color: "Silver",
      type: "SUV", seats: 5, daily: 120, weekly: [360, 420], value: 13991, down: 1000, status: "available",
      photos: ["assets/cars/sorento-2016-lx-1.jpg", "assets/cars/sorento-2016-lx-2.jpg", "assets/cars/sorento-2016-lx-3.jpg"],
      blurb: "Spacious 5-seat SUV at our best SUV price. Great for daily driving and errands.",
    },
    {
      id: "optima-2020-lx", year: 2020, make: "Kia", model: "Optima", trim: "LX", color: "Blue",
      type: "Sedan", seats: 5, daily: [120, 127], weekly: 450, value: 14799, down: 960, status: "available",
      photos: ["assets/cars/optima-2020-lx-1.jpg", "assets/cars/optima-2020-lx-2.jpg", "assets/cars/optima-2020-lx-3.jpg"],
      blurb: "Our newest sedan in a head-turning blue. Smooth, efficient and easy on gas.",
    },
    {
      id: "optima-2019-lx-grey", year: 2019, make: "Kia", model: "Optima", trim: "LX", color: "Grey",
      type: "Sedan", seats: 5, daily: [120, 125], weekly: [400, 450], value: 13991, down: 960, status: "available",
      photos: ["assets/cars/optima-2019-lx-grey-1.jpg", "assets/cars/optima-2019-lx-grey-2.jpg", "assets/cars/optima-2019-lx-grey-3.jpg"],
      blurb: "Clean, modern and comfortable — ideal for commuters, gig drivers and professionals.",
    },
    {
      id: "sentra-2013-sv", year: 2013, make: "Nissan", model: "Sentra", trim: "SV", color: "Gray",
      type: "Sedan", seats: 5, daily: 80, weekly: [289, 300], value: 5700, down: 600, status: "available", minWeekly: 175,
      photos: ["assets/cars/sentra-2013-sv-1.jpg", "assets/cars/sentra-2013-sv-2.jpg", "assets/cars/sentra-2013-sv-3.jpg"],
      blurb: "Compact, efficient and budget-friendly. Our lowest weekly rate and lowest down payment.",
    },

    // ---- Coming soon
    {
      id: "model3-2024", year: 2024, make: "Tesla", model: "Model 3", trim: "", color: "Red",
      type: "Sedan", seats: 5, daily: 140, weekly: 500, value: 27500, down: null, status: "soon",
      photos: ["assets/cars/model3-2024-1.jpg", "assets/cars/model3-2024-2.jpg", "assets/cars/model3-2024-3.jpg"],
      features: ["All-electric", "Glass roof", "Autopilot", "Touchscreen", "Heated seats"],
      blurb: "All-electric, quick and quiet. No gas station stops — ever.",
    },

    // ---- Being purchased through Rent-to-Own (shown as "Rent-to-Own in progress")
    {
      id: "sorento-2019-lx", year: 2019, make: "Kia", model: "Sorento", trim: "LX", color: "Gray",
      type: "SUV", seats: 7, daily: 135, weekly: 520, value: 17248, down: 1200, status: "rto",
      photos: ["assets/cars/sorento-2019-lx-1.jpg", "assets/cars/sorento-2019-lx-2.jpg", "assets/cars/sorento-2019-lx-3.jpg"],
      blurb: "Spacious, practical and reliable.",
    },
    {
      id: "optima-2019-lx-white", year: 2019, make: "Kia", model: "Optima", trim: "LX", color: "White",
      type: "Sedan", seats: 5, daily: [120, 125], weekly: [400, 450], value: 13291, down: 960, status: "rto",
      photos: ["assets/cars/optima-2019-lx-white-1.jpg", "assets/cars/optima-2019-lx-white-2.jpg", "assets/cars/optima-2019-lx-white-3.jpg"],
      blurb: "Clean, modern and smooth on the road.",
    },
    {
      id: "optima-2016-sx", year: 2016, make: "Kia", model: "Optima", trim: "EX", color: "White",
      type: "Sedan", seats: 5, daily: [120, 125], weekly: [400, 450], value: 14791, down: 960, status: "rto",
      photos: ["assets/cars/optima-2016-sx-1.jpg", "assets/cars/optima-2016-sx-2.jpg", "assets/cars/optima-2016-sx-3.jpg"],
      blurb: "Sporty styling with a panoramic sunroof.",
    },
    {
      id: "optima-2014-lx", year: 2014, make: "Kia", model: "Optima", trim: "LX", color: "Silver",
      type: "Sedan", seats: 5, daily: [95, 100], weekly: 360, value: 11997, down: 960, status: "rto",
      photos: ["assets/cars/optima-2014-lx-1.jpg", "assets/cars/optima-2014-lx-2.jpg", "assets/cars/optima-2014-lx-3.jpg"],
      blurb: "Budget-friendly, reliable and stylish.",
    },
  ],

  policies: {
    age: "Renters must be at least 21 years old. Additional fees may apply for drivers under 25.",
    documents: "A valid Florida driver's license, plus proof of address: at least 2 different recent documents in your name — a utility bill (electricity, water, internet or phone), a paystub, or a bank statement. A photo of your auto insurance card is optional.",
    deposit: "Daily rentals (less than a week): with 2 proofs of address the refundable security deposit is just $200. Without them, the deposit is up to $1,000 depending on the car. Either way it's returned at the end of your rental, minus any citations, tolls or fees incurred during your trip. Weekly rentals require 2 proofs of address.",
    payment: "Cash, Apple Pay, Venmo, Chime or Zelle.",
    rentals: "We offer daily and weekly rentals. Weekly rentals are heavily discounted — around 40–55% off the daily rate.",
    oneWay: "We focus on round-trip rentals only — no one-way trips.",
    pickup: "Pick-up and return are in Sarasota, FL 34234 (free). Prefer delivery? We deliver within 15 miles of 34234 for $140.",
    travel: "Drive anywhere in Florida. Cars are GPS-tracked and are not allowed outside Florida.",
    mileage: "Each car includes 200 miles per day, which is plenty: most renters never get close.",
    booking: "Once you've picked your car, book it through the Book now link. That notifies us right away and we'll confirm. Questions first? Tap Call us or Text us.",
    extend: "Contact us before your rental ends and we'll extend it whenever possible.",
    cancellation: "Plans change — contact us as early as possible and we'll work with you.",
    issues: "If anything goes wrong during your rental, contact us right away and we'll resolve it as quickly as possible.",
    assessment: "Before your first rental, every renter completes a short online assessment (about 8 minutes, 20 real-life situations). It confirms you understand our requirements and the rental agreement. You need 95% to be approved, and you'll get a results PDF to send us.",
    rideshare: "Only with our written approval. Driving for Uber, Lyft, DoorDash or any other gig or delivery app requires our explicit written authorization first, on rentals and on Rent-to-Own. Ask us before you start. Illegal use is never allowed.",
    cleanliness: "Every car is cleaned and sanitized before each rental and fully inspected for defects. We take pre- and post-trip photos every time, so there's clear documentation when the car comes back.",
    cash: "Buy outright with cash: bring the full amount in cash, we sign the clean title over to you, and you take it to the DMV for your registration and license plate.",
    rto: "Rent-to-Own is a low-stakes way into car ownership for people tired of renting week after week. No credit check. Every Rent-to-Own starts with a one-week rental: it shows you can make payments on time, and lets you get a feel for the car — anything you notice that needs fixing during that week, tell us and we'll fix it before signing. Then we meet at MIDFLORIDA to sign and notarize the agreement, you make the down payment and show proof of insurance. You pay weekly or every two weeks until the car is paid off (12 months max) and take over ongoing maintenance. No monthly payment plans.",
    rtoInsurance: "Two options. (1) Use CHURO's insurance: $60/week added to your payment. (2) Use your own policy: list CHURO as lienholder/loss payee and additional insured. Because the car stays titled in CHURO's name until it's paid off, Florida law requires us to keep at least minimum liability coverage on it, so $97/month is added to your payments for that coverage.",
    maintenance: "For rentals, we handle all maintenance. On Rent-to-Own, you take over ongoing maintenance, just like an owner.",
  },
};

/* ---------- helpers ---------- */
(function () {
  const C = window.CHURO;
  C.carName = (c) => `${c.year} ${c.make} ${c.model}${c.trim ? " " + c.trim : ""}`;
  C.money = (n, cents = true) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  C.byId = (id) => C.fleet.find((c) => c.id === id);
  C.rtoAvailable = (c) => c.status === "available";

  /* ---- today's price for ranged rates (stable per day, same for every visitor) ---- */
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); // YYYY-MM-DD
  const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
  const resolve = (v, key) => Array.isArray(v) ? Math.round(v[0] + hash(today + key) * (v[1] - v[0])) : v;
  // Without 2 proofs of address: the lesser of $1,000 and 15% of the car's value (rounded up to the next $10).
  // Customers only see the dollar amount. Must match the Fillout booking form.
  C.depositDaily = (c, hasProofs) => (hasProofs ? 200 : Math.min(1000, Math.ceil((c.value * 0.15) / 10) * 10));
  C.depositList = () => C.fleet.filter((c) => c.status === "available")
    .sort((a, b) => C.depositDaily(a, false) - C.depositDaily(b, false))
    .map((c) => `${C.carName(c)} (${c.color}): $${C.depositDaily(c, false).toLocaleString("en-US")}`);
  C.fleet.forEach((c) => {
    c.dailyRange = Array.isArray(c.daily) ? c.daily : null;
    c.weeklyRange = Array.isArray(c.weekly) ? c.weekly : null;
    c.daily = resolve(c.daily, c.id + ":d");
    c.weekly = resolve(c.weekly, c.id + ":w");
    c.weeklySavingsPct = Math.round((1 - c.weekly / (c.daily * 7)) * 100); // vs. paying the daily rate 7 times
  });
  C.priceDate = today;

  /** Rental estimate: full weeks at the weekly rate, leftover days at the daily rate (capped at a week). */
  C.rentalQuote = (carId, days) => {
    const c = C.byId(carId);
    if (!c) return null;
    days = Math.max(1, Math.round(days));
    const weeks = Math.floor(days / 7), rest = days % 7;
    const total = weeks * c.weekly + Math.min(rest * c.daily, c.weekly);
    return { car: c, days, weeks, rest, total, savings: days * c.daily - total };
  };

  /* ---- Rent-to-Own ---- */
  const perYearOf = (f) => (f === "biweekly" ? 26 : 52);
  const amortize = (principal, apr, perYear, n) => { const r = apr / perYear; return r ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n; };
  const periodsFor = (months, perYear) => Math.max(1, Math.round((months * perYear) / 12));
  C.minWeekly = (c) => c.minWeekly || C.rto.minWeeklyDefault;

  /** Longest term (≤ 12 months) whose weekly car payment still meets the car's minimum. */
  C.rtoMaxMonths = (c) => {
    const principal = c.value - c.down;
    for (let m = C.rto.maxMonths; m >= 1; m--) {
      if (amortize(principal, C.rto.apr, 52, periodsFor(m, 52)) >= C.minWeekly(c) - 0.005) return m;
    }
    return 1;
  };

  /**
   * Rent-to-Own quote.
   * 1) one-week rental at today's weekly rate, 2) down payment at signing,
   * 3) (value − down) financed at rto.apr, repaid weekly or bi-weekly,
   * plus an insurance add-on per payment.
   */
  C.rtoQuote = ({ carId, months, frequency = "weekly", insurance = "own" }) => {
    const c = C.byId(carId);
    if (!c) return null;
    const maxMonths = C.rtoMaxMonths(c);
    months = Math.min(maxMonths, Math.max(1, Math.round(months || maxMonths)));
    const perYear = perYearOf(frequency);
    const n = periodsFor(months, perYear);
    const principal = c.value - c.down;
    const carPayment = amortize(principal, C.rto.apr, perYear, n);
    const insurancePer = insurance === "churo"
      ? C.rto.churoInsuranceWeekly * (52 / perYear)
      : (C.rto.ownInsuranceMonthly * 12) / perYear;
    const payment = carPayment + insurancePer;
    const totalCarPayments = carPayment * n;
    const interest = totalCarPayments - principal;
    const firstWeek = C.rto.firstWeekRequired ? c.weekly : 0;
    const carTotal = firstWeek + c.down + totalCarPayments;          // what the car costs you
    const insuranceTotal = insurancePer * n;
    const start = new Date(); start.setHours(12, 0, 0, 0);
    const signing = new Date(start); signing.setDate(signing.getDate() + 7);
    const payoff = new Date(signing); payoff.setDate(payoff.getDate() + (frequency === "biweekly" ? 14 : 7) * n);
    return {
      car: c, months, maxMonths, frequency, perYear, n, principal, carPayment, insurance, insurancePer, payment,
      interest, firstWeek, carTotal, insuranceTotal, grandTotal: carTotal + insuranceTotal,
      minPerPeriod: C.minWeekly(c) * (52 / perYear), signing, payoff, available: C.rtoAvailable(c),
    };
  };
})();
