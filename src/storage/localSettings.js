const KEY_LANG = "mri_lang";
const KEY_LOOKBACK = "mri_lookback";

export function loadLang(defaultLang = "en") {
  try {
    return localStorage.getItem(KEY_LANG) || defaultLang;
  } catch {
    return defaultLang;
  }
}

export function saveLang(lang) {
  try {
    localStorage.setItem(KEY_LANG, lang);
  } catch {
    // ignore
  }
}

// Period / lookback selection for B page.
// This is forward-compatible: UI can show the selected period even if backend
// hasn't started emitting period aggregates yet.
export function loadLookback(defaultLookback = "252d") {
  try {
    return localStorage.getItem(KEY_LOOKBACK) || defaultLookback;
  } catch {
    return defaultLookback;
  }
}

export function saveLookback(lookback) {
  try {
    localStorage.setItem(KEY_LOOKBACK, String(lookback || "252d"));
  } catch {
    // ignore
  }
}
