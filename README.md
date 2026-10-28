# CHURO Car Rentals: Sarasota

Website for CHURO Car Rentals (Drive Luxuriously, LLC). It covers daily and weekly rentals, Rent-to-Own with no credit check, and cars for sale. It also has an AI chat assistant.

Live: <https://churo-car-rentals.github.io/>

## Features
- **Fleet tiles** with a photo strip for each car: swipe on phones, or hover/tap the thumbnails. Each tile shows its availability badge and daily and weekly prices.
- **Rental estimator:** pick dates, and every tile shows the estimated total. Full weeks are charged at the weekly rate.
- **Rent-to-Own calculator:** shows weekly or bi-weekly payments over 1–12 months. The total includes the required first-week rental, the down payment and 8% APR. It also says whether the chosen car is available for Rent-to-Own.
- **Cars for sale:** cash prices, with the Rent-to-Own alternative shown next to each.
- **Churo chat assistant:** answers questions about rentals, Rent-to-Own and cash purchases. Rent-to-Own questions about a specific car load that car into the calculator.
- Booking goes to the existing Fillout form. Questions go to the existing Google contact form.

## Run locally
```bash
python3 -m http.server 8000
```
Then open <http://localhost:8000>. Adding `#chat` to the address opens the assistant.

## Updating the fleet
Edit **`js/data.js`**. It is the single source of truth for the tiles, the calculator, the for-sale list and the chatbot.
- `status: "available"` means the car is offered to rent, for Rent-to-Own and for sale. `status: "rto"` shows it as "Rent-to-Own in progress" (not available).
- `daily`, `weekly`: rental rates. Use a number, or a `[min, max]` range: ranges pick a new price each day (the same for every visitor that day).
- `value`: the cash price. `down`: the Rent-to-Own down payment. `minWeekly`: minimum weekly car payment (default $300, Sentra $175). This sets each car's longest term.
- Rent-to-Own insurance: `rto.churoInsuranceWeekly` ($60/week) or `rto.ownInsuranceMonthly` ($97/month of liability coverage when the customer uses their own policy).
- `photos`: up to 3 images per car (`assets/cars/<id>-1..3.jpg`, 1200×900). Strip location data before adding phone photos.
- `rto.apr` / `rto.maxMonths`: the Rent-to-Own terms.

Never put customer names, VINs or other private details in this file. Everything in it is public.

## Chat assistant engines (⚙️ in the chat)
Most questions (prices, Rent-to-Own payments, deposits, requirements, travel, booking) get an **instant, verified answer** from the built-in engine. An AI model is only used for open-ended questions, with a 25-second limit; if it's slower, the built-in answer (or "call us") is shown instead.

| Engine | Notes |
|---|---|
| **Auto** (default) | Uses Ollama if the site runs on your own computer, otherwise built-in only |
| **Ollama** | Free local model (`ollama pull llama3.2`). Works only on the computer running Ollama |
| **In-browser AI** | Each visitor's browser downloads a ~900 MB model. Needs a recent Mac (Apple Silicon) or a PC with a good graphics card; too slow on older Intel graphics |
| **Built-in** | Instant, offline, always accurate. What public visitors get by default |

## Files
```
index.html         single-page site (old about/fleet/contact/faq pages redirect here)
css/styles.css     styling (ocean-blue theme)
js/data.js         ★ fleet, prices, Rent-to-Own terms, policies
js/app.js          tiles, photo strips, estimator, calculator, for-sale list
js/chatbot.js      chat assistant
assets/cars/       car photos
assets/brand/      logos and hero image
```

## QR codes

`qr/qr-churo.png` (QR with logo) and `qr/qr-churo-affiche.png` (printable poster) point to https://churo-car-rentals.github.io/. Rebuild with `python qr/make_qr.py`.
