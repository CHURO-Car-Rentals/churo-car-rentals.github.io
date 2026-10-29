// Renter assessment settings.
export default {
  business: "Drive Luxuriously, LLC",
  brand: "CHURO Car Rentals",
  ownerPhone: "+14049528569", // where renters send their results (text / WhatsApp)
  minMinutes: 4,              // can't submit faster than this
  fastSeconds: 5,             // answers quicker than this are flagged as "not read"
  retakeHours: 24,            // wait after a failed attempt
  // Free automatic copy of every result to the owner's email: create an access key at https://web3forms.com
  // (enter the owner's email, copy the key here). Leave empty to turn it off.
  web3formsKey: "",
};
