<script lang="ts">
  import { exportAll, downloadJSON, parseBundleFile, importBundle, type ImportMode } from '../lib/io';
  import { users, postcards, holdings } from '../lib/stores';
  import { buildInfo, commitUrl } from '../lib/buildInfo';

  const builtAtLocal = (() => {
    try { return new Date(buildInfo.builtAt).toLocaleString(); }
    catch { return buildInfo.builtAt; }
  })();

  let importMode: ImportMode = $state('merge');
  let status = $state('');
  let fileInput: HTMLInputElement;

  async function doExport() {
    const bundle = await exportAll();
    downloadJSON(bundle);
    status = `已匯出：${bundle.users.length} users / ${bundle.postcards.length} postcards / ${bundle.holdings.length} holdings`;
  }

  async function doImport(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const bundle = await parseBundleFile(file);
      const verb = importMode === 'replace' ? '取代' : '合併';
      if (!confirm(`將以 [${verb}] 方式匯入 ${bundle.users.length} users / ${bundle.postcards.length} postcards / ${bundle.holdings.length} holdings，確定？`)) {
        target.value = '';
        return;
      }
      const result = await importBundle(bundle, importMode);
      status = `匯入完成：${result.users} users / ${result.postcards} postcards / ${result.holdings} holdings`;
    } catch (err) {
      status = `匯入失敗：${err instanceof Error ? err.message : String(err)}`;
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

  {#if status}
    <p class="status">{status}</p>
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
