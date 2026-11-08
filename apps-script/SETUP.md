# Connect CHURO to a Google Sheet (about 10 minutes)

This gives CHURO:

- **An "Assessments" tab.** Every renter assessment attempt is saved there:
  - name, phone and email
  - date of birth, license state and number, and any license-check warnings
  - score, pass/fail, attempt number and time taken
  - a Status column (Pending review / Approved / Declined / Retake needed)
- **Anonymous visit stats.** It records visits, where visitors came from, WhatsApp/Call/Text taps, "Book" clicks per car, Turo clicks and chatbot questions.
- **The private dashboard** at `/pit/`.

**Privacy:** the Sheet holds license numbers and dates of birth, so share it only with people who need it. In the dashboard, license numbers stay masked until you click them. Results emails and PDFs through Web3Forms keep working as before.

## 1. Create the Sheet

1. Sign in to the Google account that should own the data, then open **https://sheets.new**.
2. Name it **CHURO: Website**.
3. Use **Share** to add anyone else who should see it.

## 2. Add the script

1. In the Sheet, open **Extensions → Apps Script**.
2. Delete the sample code. Paste in everything from `apps-script/Code.gs`.
3. Click 💾 **Save**.
4. In the toolbar's function menu, choose **setup**, then click **▶ Run**.
5. Google asks for permission:
   1. Click **Review permissions** and choose your account.
   2. You'll see "Google hasn't verified this app". That's expected, because it's your own script. Click **Advanced → Go to … (unsafe) → Allow**.
6. Back in the Sheet, you'll now have **Assessments** and **Events** tabs.

## 3. Set the dashboard passcode

1. In Apps Script, click ⚙️ **Project Settings**, scroll to **Script properties** and click **Add script property**.
2. Fill it in:
   - **Property:** `ADMIN_KEY`
   - **Value:** a long passcode (at least 12 characters).
3. Click **Save script properties**.

Use a different passcode from your other sites. After 8 wrong tries, the dashboard locks for 15 minutes.

## 4. Publish it as a web app

1. Click **Deploy → New deployment**.
2. Click ⚙️ next to "Select type" and choose **Web app**:
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
3. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
4. Send it to Claude, or paste it in **two** places and publish:
   - `js/track.js`, as `url: "…/exec"`
   - `pit/spec.js`, as `url: "…/exec"`

## 5. Open the dashboard

**To get there:** at the bottom of the website, tap the **© 2026 CHURO Car Rentals** line **5 times quickly**. You can also go straight to `https://churo-car-rentals.github.io/pit/`. Nothing on the site points there, and search engines are told to skip it.

**To sign in:** enter the passcode and keep **Remember this device** checked. On a phone, use **Share → Add to Home Screen** so it opens like an app.

**Preview:** `https://churo-car-rentals.github.io/pit/?demo` shows the dashboard with sample data.

## Changing the script later

1. Paste in the new `Code.gs` and save.
2. Click **Deploy → Manage deployments → ✏️ Edit**, set **Version** to **New version**, and click **Deploy**.
3. The URL stays the same, so the website doesn't need to change.
