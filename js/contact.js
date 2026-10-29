/* Call / Text buttons without showing the phone number in the page.
   The number is put together only when someone taps a button, so it never
   appears in the page text or source as a readable number (keeps it away
   from scrapers and spam bots). Works for:
   - <a data-contact="call"> / <a data-contact="text">
   - chatbot links written as [Call us](#call) and [Text us](#text) */
(function () {
  const parts = ["+1", "404", "952", "85", "69"];
  const num = () => parts.join("");
  window.ChuroContact = {
    call: () => { location.href = "tel:" + num(); },
    text: (body) => { location.href = "sms:" + num() + (body ? (/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?") + "body=" + encodeURIComponent(body) : ""); },
  };
  document.addEventListener("click", function (e) {
    if (e.target.closest('a[href="#assessment"]')) { e.preventDefault(); location.href = "renter-quiz/"; return; }
    const el = e.target.closest('[data-contact], a[href="#call"], a[href="#text"]');
    if (!el) return;
    e.preventDefault();
    const kind = el.dataset.contact || el.getAttribute("href").slice(1);
    if (kind === "call") window.ChuroContact.call();
    else window.ChuroContact.text(el.dataset.body || "");
  });
})();
