// 日夜模式偏好：'system' = 跟隨系統（不設 data-theme，交給 CSS media query），
// 'light'/'dark' = 手動覆寫（設 <html data-theme>，app.css 的屬性選擇器優先於 media query）。
// ⚠️ index.html <head> 有一段內聯腳本在首次繪製前做同樣的事（避免閃色），
// KEY 與判斷邏輯改動時必須同步改那裡。
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'pm-theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // 讀不到就跟隨系統
  }
  return 'system';
}

export function applyThemePref(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // 寫不進就僅本 session 生效
  }
  applyThemePref(pref);
}
