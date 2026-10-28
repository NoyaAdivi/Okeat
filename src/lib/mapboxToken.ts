// Mapbox *public* token (pk.…). Public tokens are meant to be shipped to the browser,
// so keeping one here is safe; restrict it to your domains in the Mapbox dashboard.
// NEXT_PUBLIC_MAPBOX_TOKEN in .env.local wins when it is set and well-formed.
const FALLBACK = 'pk.eyJ1Ijoibm95YWEiLCJhIjoiY212cDg2OGdrMDE3bDJ6czZyNHF4bXdmbiJ9.0pLZkxfgNMro2e4iuTmGbA';

// A full public token looks like pk.<payload>.<signature>; a token cut across two lines doesn't.
const looksValid = (t: string | undefined): t is string => !!t && /^pk\.[\w-]+\.[\w-]{10,}$/.test(t.trim());

const fromEnv = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
export const MAPBOX_TOKEN: string = looksValid(fromEnv) ? fromEnv.trim() : FALLBACK;
