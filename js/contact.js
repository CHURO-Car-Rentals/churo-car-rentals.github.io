/* WhatsApp / Call / Text buttons without showing the phone number in the page.
   The number is put together only when someone taps a button, so it never
   appears in the page text or source as a readable number (keeps it away
   from scrapers and spam bots). Works for:
   - <a data-contact="wa|call|text" data-body="message">
   - chatbot links written as [WhatsApp us](#wa), [Call us](#call), [Text us](#text) */
(function () {
  const parts = ["+1", "404", "952", "85", "69"];
  const num = () => parts.join("");
  const HELLO = "Hi CHURO, I'm reaching out from your website.";
  window.ChuroContact = {
    lastQuestion: "", // set by the chatbot so the WhatsApp message carries the customer's question
    whatsapp: (body) => {
      const text = body || (window.ChuroContact.lastQuestion ? `${HELLO}\n\n${window.ChuroContact.lastQuestion}` : HELLO);
      window.SiteTrack && SiteTrack.event("wa", window.ChuroContact.lastQuestion ? "from chat" : "");
      window.open(`https://wa.me/${num().replace("+", "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    },
    call: () => { window.SiteTrack && SiteTrack.event("call"); location.href = "tel:" + num(); },
    text: (body) => { window.SiteTrack && SiteTrack.event("text"); location.href = "sms:" + num() + (body ? (/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?") + "body=" + encodeURIComponent(body) : ""); },
  };
  document.addEventListener("click", function (e) {
    // Book (per car) and Turo clicks, for the private dashboard
    const out = e.target.closest('a[href*="forms.fillout.com"], a[href*="turo.com"]');
    if (out && window.SiteTrack) {
      const card = out.closest(".car"), name = card && card.querySelector(".car__name");
      if (/turo\.com/.test(out.href)) SiteTrack.event("turo");
      else SiteTrack.event("book", name ? name.firstChild.textContent.trim() : "");
    }
    if (e.target.closest('a[href="#assessment"]')) { e.preventDefault(); location.href = "renter-quiz/"; return; }
    const el = e.target.closest('[data-contact], a[href="#wa"], a[href="#call"], a[href="#text"]');
    if (!el) return;
    e.preventDefault();
    const kind = el.dataset.contact || el.getAttribute("href").slice(1);
    if (kind === "wa") window.ChuroContact.whatsapp(el.dataset.body || "");
    else if (kind === "call") window.ChuroContact.call();
    else window.ChuroContact.text(el.dataset.body || "");
  });
})();
