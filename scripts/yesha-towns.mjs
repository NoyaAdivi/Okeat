// Israeli towns in Judea and Samaria, each with a center and how far it reaches in meters.
// The map imports cover Israel by its country border, which leaves these out. Importing by town,
// and not by a box around the whole area, keeps the map to places people here are looking for.
export const TOWNS = [
  ['אריאל', 32.106, 35.185, 2600], ['ברקן', 32.105, 35.112, 1800], ['קרני שומרון', 32.172, 35.098, 2000],
  ['עמנואל', 32.161, 35.135, 1200], ['קדומים', 32.213, 35.159, 1500], ['שבי שומרון', 32.263, 35.128, 900],
  ['אורנית', 32.131, 34.989, 1400], ['שערי תקווה', 32.127, 35.022, 1200], ['אלקנה', 32.110, 35.034, 1200],
  ['אלפי מנשה', 32.168, 35.008, 1100], ['בית אריה', 32.038, 35.051, 1400], ['עלי', 32.067, 35.263, 1000],
  ['שילה', 32.053, 35.298, 1000], ['עפרה', 31.957, 35.261, 900], ['בית אל', 31.943, 35.222, 900],
  ['כוכב יעקב', 31.882, 35.246, 900], ['מעלה אדומים', 31.777, 35.298, 3000], ['מישור אדומים', 31.797, 35.327, 1500],
  ['כפר אדומים', 31.822, 35.341, 1000], ['גבעת זאב', 31.859, 35.170, 1500], ['מודיעין עילית', 31.932, 35.042, 2000],
  ['חשמונאים', 31.932, 35.019, 900], ['מבוא חורון', 31.849, 35.031, 700], ['ביתר עילית', 31.697, 35.116, 2000],
  ['אפרת', 31.653, 35.150, 2000], ['נווה דניאל', 31.677, 35.142, 800], ['אלון שבות', 31.654, 35.123, 1000],
  ['כפר עציון', 31.648, 35.116, 800], ['צומת גוש עציון', 31.640, 35.131, 700], ['תקוע', 31.628, 35.221, 1000],
  ['קריית ארבע', 31.533, 35.120, 1000], ['קדומים תעשייה', 32.205, 35.150, 600], ['פארק ברקן', 32.097, 35.103, 1200],
];

const meters = (lat, lng, a, b) => Math.hypot((lat - a) * 111_000, (lng - b) * 111_000 * Math.cos(lat * Math.PI / 180));

/**
 * Some towns sit right next to Palestinian towns, and a circle on the map cannot tell them apart.
 * A place stays if it has a Hebrew name, a kosher tag, or a name that is plainly an Israeli-style chain or pizza place.
 */
export const fitsTowns = (names, kosher = false) =>
  kosher || names.some((n) => /[א-ת]/.test(n ?? '') || /aroma|burger ranch|pizza|cofix|landwer|roladin/i.test(n ?? ''));

/** The town a point belongs to, if any. */
export const townAt = (lat, lng) => TOWNS.find(([, a, b, r]) => meters(lat, lng, a, b) <= r)?.[0] ?? null;
