// 手動觸發 SW 更新檢查。registration 由 UpdatePrompt 的 onRegisteredSW 塞入。
// reg.update() = 立刻重抓 sw.js 做 byte-diff（與頁面載入時的檢查同一機制）；
// 發現新版時走既有 needRefresh 流程（UpdatePrompt toast），這裡只回報結果。
let reg: ServiceWorkerRegistration | null = null;

export function setRegistration(r: ServiceWorkerRegistration): void {
  reg = r;
}

export type UpdateCheckResult = 'update-found' | 'up-to-date' | 'no-sw';

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!reg) return 'no-sw';
  await reg.update();
  return reg.installing || reg.waiting ? 'update-found' : 'up-to-date';
}
