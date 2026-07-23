<script lang="ts">
  import { onMount } from 'svelte';
  import { exportAll, downloadJSON, parseBundleFile, importBundle, type ImportMode } from '../lib/io';
  import { users, postcards, holdings } from '../lib/stores';
  import { db, withTimeout } from '../lib/db';
  import { buildInfo, commitUrl } from '../lib/buildInfo';

  // 直接對 DB count()（不走 liveQuery/index）：把「DB 打不開/被鎖」和「DB 是空的」區分開。
  // liveQuery store 出錯時會永遠停在 []，畫面上與空資料無法分辨——這裡是診斷的事實來源。
  // 逐 store 各自帶逾時：IndexedDB 鎖按 object store 計，單一 store 被別的視窗鎖住時
  // 該操作會無限懸掛（不拋錯），逾時是唯一訊號；分開探測才能指出是哪個 store 卡住。
  let counts: { users: string; postcards: string; holdings: string } | null = $state(null);
  let countsHint = $state('');
  let persisted: boolean | null = $state(null);
  let storageInfo = $state('');

  async function probeCount(table: { count(): Promise<number> }): Promise<string> {
    try {
      return String(await withTimeout(table.count(), 4000));
    } catch (err) {
      return err instanceof Error && err.message === 'timeout'
        ? '逾時'
        : `錯誤：${err instanceof Error ? err.name : String(err)}`;
    }
  }

  async function refreshCounts() {
    counts = null;
    countsHint = '';
    const [u, p, h] = await Promise.all([probeCount(db.users), probeCount(db.postcards), probeCount(db.holdings)]);
    counts = { users: u, postcards: p, holdings: h };
    if ([u, p, h].some((v) => !/^\d+$/.test(v))) {
      countsHint =
        '「逾時」通常表示該 store 被其他視窗/分頁的未完成交易鎖住：請完全關閉本 app 的所有視窗與分頁（含已安裝的 PWA），必要時重啟瀏覽器後再開。資料多半仍在，只是被鎖住讀不到。';
    }
    try {
      if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage != null && est.quota != null) {
          storageInfo = `${(est.usage / 1024 / 1024).toFixed(1)} MB / ${(est.quota / 1024 / 1024).toFixed(0)} MB`;
        }
      }
    } catch {
      // storage estimate 非關鍵，失敗就不顯示
    }
  }

  async function requestPersist() {
    try {
      persisted = await navigator.storage.persist();
      if (persisted) showNotice('success', '持久儲存已啟用，瀏覽器空間壓力下不會回收本站資料');
      else showNotice('error', '瀏覽器拒絕了持久儲存請求（安裝為 PWA 後通常會自動允許，可再試）');
    } catch (err) {
      showNotice('error', `持久儲存請求失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  onMount(refreshCounts);

  const builtAtLocal = (() => {
    try { return new Date(buildInfo.builtAt).toLocaleString(); }
    catch { return buildInfo.builtAt; }
  })();

  let importMode: ImportMode = $state('merge');
  let fileInput: HTMLInputElement;

  // 置頂通知列：成功 4 秒自動消失，錯誤留著等手動關閉
  let notice: { kind: 'success' | 'error'; text: string } | null = $state(null);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  function showNotice(kind: 'success' | 'error', text: string) {
    clearTimeout(noticeTimer);
    notice = { kind, text };
    if (kind === 'success') noticeTimer = setTimeout(() => (notice = null), 4000);
  }

  function dismissNotice() {
    clearTimeout(noticeTimer);
    notice = null;
  }

  async function doExport() {
    const bundle = await exportAll();
    downloadJSON(bundle);
    showNotice('success', `已匯出：${bundle.users.length} users / ${bundle.postcards.length} postcards / ${bundle.holdings.length} holdings`);
  }

  async function doImport(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const { bundle, fixed } = await parseBundleFile(file);
      const verb = importMode === 'replace' ? '取代' : '合併';
      const fixNote = fixed > 0 ? `\n（其中 ${fixed} 筆紀錄有缺漏欄位，將自動補齊）` : '';
      if (!confirm(`將以 [${verb}] 方式匯入 ${bundle.users.length} users / ${bundle.postcards.length} postcards / ${bundle.holdings.length} holdings，確定？${fixNote}`)) {
        target.value = '';
        return;
      }
      const result = await importBundle(bundle, importMode);
      showNotice('success', `匯入完成：${result.users} users / ${result.postcards} postcards / ${result.holdings} holdings${fixed > 0 ? `（已補齊 ${fixed} 筆缺漏欄位）` : ''}`);
      refreshCounts();
    } catch (err) {
      showNotice('error', `匯入失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      target.value = '';
    }
  }
</script>

<section>
  <h2>設定</h2>

  <div class="card">
    <h3>資料統計</h3>
    <ul>
      <li>用戶：{$users.length}（庫內實測 {counts ? counts.users : '查詢中…'}）</li>
      <li>明信片：{$postcards.length}（庫內實測 {counts ? counts.postcards : '查詢中…'}）</li>
      <li>持有關聯：{$holdings.length}（庫內實測 {counts ? counts.holdings : '查詢中…'}）</li>
    </ul>
    {#if countsHint}
      <p class="count-error">⚠️ {countsHint}</p>
    {/if}
    <div class="stats-meta">
      <button type="button" onclick={refreshCounts}>重新計數</button>
      <span>
        持久儲存：{persisted === null ? '未知' : persisted ? '已啟用' : '未啟用'}
        {#if persisted === false}
          <button type="button" onclick={requestPersist}>啟用</button>
        {/if}
      </span>
      {#if storageInfo}<span>用量 {storageInfo}</span>{/if}
    </div>
  </div>

  <div class="card">
    <h3>匯出</h3>
    <p>下載完整 JSON 備份。</p>
    <button onclick={doExport}>匯出 JSON</button>
  </div>

  <div class="card">
    <h3>匯入</h3>
    <fieldset>
      <legend>匯入模式</legend>
      <label><input type="radio" bind:group={importMode} value="merge" /> 合併（同 id 覆蓋，其餘保留）</label>
      <label><input type="radio" bind:group={importMode} value="replace" /> 取代（清空後寫入）</label>
    </fieldset>
    <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={doImport} />
  </div>

  {#if notice}
    <div class="notice {notice.kind}" role="alert">
      <span class="notice-text">{notice.text}</span>
      <button type="button" class="notice-x" onclick={dismissNotice} aria-label="關閉">✕</button>
    </div>
  {/if}

  <div class="card">
    <h3>版本資訊</h3>
    <dl class="kv">
      <dt>version</dt>
      <dd>{buildInfo.version}</dd>
      <dt>commit</dt>
      <dd>
        {#if buildInfo.commit === 'unknown'}
          <code>unknown</code>
        {:else}
          <a href={commitUrl(buildInfo.commit)} target="_blank" rel="noreferrer"><code>{buildInfo.commit}</code></a>
        {/if}
      </dd>
      <dt>built</dt>
      <dd>{builtAtLocal}</dd>
    </dl>
  </div>
</section>

<style>
  .notice {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    color: #fff;
    font-size: 0.9rem;
  }
  .notice.success { background: #2e7d32; }
  .notice.error { background: #c62828; }
  .notice-text { flex: 1; white-space: pre-wrap; }
  .notice-x {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1rem;
    line-height: 1;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  .count-error {
    color: #c62828;
    font-size: 0.9rem;
    white-space: pre-wrap;
  }
  .stats-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .stats-meta button {
    padding: 0.25rem 0.625rem;
    font-size: 0.85rem;
  }

  .kv {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0;
    font-size: 0.9rem;
  }
  .kv dt { color: var(--muted); }
  .kv dd { margin: 0; }
  .kv code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>
