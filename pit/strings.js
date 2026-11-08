// Dashboard text shared by every site (English + French). Site-specific text lives in spec.js.
window.PIT_BASE = {
  en: {
    locale: "en-US", title: "Dashboard", passcode: "Passcode", remember: "Remember this device", unlock: "Unlock", unlocking: "Unlocking…",
    unlocked: "Unlocked", welcome: "Welcome back", signedOut: "Signed out.", refresh: "↻ Refresh", openSheet: "Open Sheet ↗", signOut: "Sign out",
    daysN: "{n} days", year1: "1 year", demo: "Sample data: this is a preview. Real data shows up once the Google Sheet is connected.",
    search: "Search…", status: "Status", nothing: "Nothing to show.", saved: "Saved: {name} is now {status}", notSaved: "Couldn't save. Try again.",
    visitorsPerDay: "Visitors per day", busiest: "Busiest day: {day} ({n} visitors)", showTable: "Show as table", day: "Day", visitors: "Visitors",
    visits: "visits", sources: "Where visitors come from", devices: "Devices", shareVisits: "Share of visits", other: "Other", noData: "No data yet for this period.",
    chatTitle: "What people ask the chatbot", onlyMissed: "Only questions it couldn't answer", answered: "Answered", sentWa: "Sent to WhatsApp",
    allAnswered: "The chatbot answered everything. ✓", noChat: "No chatbot questions in this period.",
    footer: "Everything here lives in your Google Sheet. This device is left out of visitor counts.",
    vsPrev: "vs. previous {n} days", new: "New", noChange: "No change", same: "Same as",
    errWrong: "That passcode isn't right.", errLocked: "Too many tries. Wait 15 minutes, then try again.",
    errSetup: "The passcode hasn't been set in the Google Sheet yet (see SETUP.md).", errConnect: "The website isn't connected to the Google Sheet yet (see SETUP.md).",
    errNet: "Couldn't reach the Google Sheet. Check your connection and try again.",
    src: { google: "Google search", instagram: "Instagram", facebook: "Facebook", qr: "QR code", direct: "Direct / typed in", whatsapp: "WhatsApp link", turo: "Turo", bing: "Bing", yahoo: "Yahoo" },
    dev: { phone: "Phone", desktop: "Computer", tablet: "Tablet", unknown: "Unknown" },
  },
  fr: {
    locale: "fr-FR", title: "Tableau de bord", passcode: "Code d'accès", remember: "Se souvenir de cet appareil", unlock: "Déverrouiller", unlocking: "Vérification…",
    unlocked: "Déverrouillé", welcome: "Bon retour", signedOut: "Déconnecté.", refresh: "↻ Actualiser", openSheet: "Ouvrir la feuille ↗", signOut: "Se déconnecter",
    daysN: "{n} jours", year1: "1 an", demo: "Données d'exemple : ceci est un aperçu. Les vraies données apparaissent une fois la feuille Google connectée.",
    search: "Rechercher…", status: "Statut", nothing: "Rien à afficher.", saved: "Enregistré : {name} est maintenant « {status} »", notSaved: "Échec de l'enregistrement. Réessayez.",
    visitorsPerDay: "Visiteurs par jour", busiest: "Jour le plus actif : {day} ({n} visiteurs)", showTable: "Voir en tableau", day: "Jour", visitors: "Visiteurs",
    visits: "visites", sources: "D'où viennent les visiteurs", devices: "Appareils", shareVisits: "Part des visites", other: "Autre", noData: "Pas encore de données sur cette période.",
    chatTitle: "Ce que les gens demandent à l'assistant", onlyMissed: "Seulement les questions sans réponse", answered: "Répondu", sentWa: "Envoyé sur WhatsApp",
    allAnswered: "L'assistant a répondu à tout. ✓", noChat: "Aucune question à l'assistant sur cette période.",
    footer: "Toutes ces données sont dans votre feuille Google. Cet appareil n'est pas compté dans les visites.",
    vsPrev: "par rapport aux {n} jours précédents", new: "Nouveau", noChange: "Pas de changement", same: "Identique",
    errWrong: "Ce code d'accès n'est pas correct.", errLocked: "Trop d'essais. Attendez 15 minutes puis réessayez.",
    errSetup: "Le code d'accès n'est pas encore défini dans la feuille Google (voir SETUP.md).", errConnect: "Le site n'est pas encore relié à la feuille Google (voir SETUP.md).",
    errNet: "Impossible de joindre la feuille Google. Vérifiez la connexion et réessayez.",
    src: { google: "Recherche Google", instagram: "Instagram", facebook: "Facebook", qr: "Code QR", direct: "Direct / saisi", whatsapp: "Lien WhatsApp", bing: "Bing", yahoo: "Yahoo" },
    dev: { phone: "Téléphone", desktop: "Ordinateur", tablet: "Tablette", unknown: "Inconnu" },
  },
};
// spec.js calls this to add its own text on top of the shared text
window.pitText = (extra) => { const out = {}; Object.keys(window.PIT_BASE).forEach((l) => (out[l] = { ...window.PIT_BASE[l], ...(extra[l] || {}) })); return out; };
