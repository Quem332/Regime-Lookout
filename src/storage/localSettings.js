const KEY_LANG = "mri_lang";

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
