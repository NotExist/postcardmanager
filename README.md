# postcardmemo

離線優先 PWA，管理用戶與明信片，以及用戶持有明信片的關聯。

## 技術棧

- Svelte 5 + TypeScript + Vite 8
- Dexie.js（IndexedDB wrapper）
- vite-plugin-pwa（Workbox）
- 部署：GitHub Pages（GitHub Actions workflow）

## 資料模型

- `users(id, displayName, note, createdAt, updatedAt)`
- `postcards(id, name, lat, lon, version, note, createdAt, updatedAt)`
- `holdings(id, userId, postcardId, acquiredAt, note)` — 用戶 × 明信片 多對多

PK 為 UUID。重複偵測使用業務欄位：
- 新增持有時：檢查該用戶是否已持有同 id / 同 name / 同 (lat, lon) 的明信片
- 新增明信片時：檢查全域是否有同 name / 同 (lat, lon)
- 新增用戶時：檢查同 displayName

## 開發

```bash
npm install
npm run dev
npm run build
npm run check   # svelte-check + tsc
```

## 部署

推到 `main` 後 GitHub Actions 會自動 build 並部署到 GitHub Pages。
`BASE_PATH` 自動設為 `/<repo-name>/`，本機 dev 仍為 `/`。

## 匯出 / 匯入

設定頁可下載 JSON bundle（`schemaVersion: 1`），匯入支援 merge 與 replace 兩種模式。
