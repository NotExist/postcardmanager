<script lang="ts">
  import { exportAll, downloadJSON, parseBundleFile, importBundle, type ImportMode } from '../lib/io';
  import { users, postcards, holdings } from '../lib/stores';
  import { buildInfo, commitUrl } from '../lib/buildInfo';

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
      <li>用戶：{$users.length}</li>
      <li>明信片：{$postcards.length}</li>
      <li>持有關聯：{$holdings.length}</li>
    </ul>
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
