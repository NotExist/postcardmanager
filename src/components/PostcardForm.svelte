<script lang="ts">
  import { db, uid, now } from '../lib/db';
  import { findPostcardDuplicates } from '../lib/dupCheck';
  import type { Postcard } from '../lib/types';

  // 新增與編輯共用的明信片編輯器。
  // postcard=null → 新增模式（含 dup 偵測）；有值 → 編輯模式（在原位取代列表項，含刪除鈕）。
  interface Props {
    postcard?: Postcard | null;
    onDone: () => void;
  }
  let { postcard = null, onDone }: Props = $props();

  // 表單以掛載當下的 postcard 為快照：編輯中不讓 liveQuery 更新覆寫輸入內容。
  // 每次開啟編輯都是新的元件實例（#each/#if 內），重掛載即重新初始化。
  // svelte-ignore state_referenced_locally
  const initial = postcard;
  let name = $state(initial?.name ?? '');
  let latStr = $state(initial?.lat != null ? String(initial.lat) : '');
  let lonStr = $state(initial?.lon != null ? String(initial.lon) : '');
  let version = $state(initial?.version ?? '');
  let note = $state(initial?.note ?? '');
  let dupWarning: Postcard[] = $state([]);

  function parseCoord(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  async function submit(force = false) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const lat = parseCoord(latStr);
    const lon = parseCoord(lonStr);

    if (postcard) {
      await db.postcards.update(postcard.id, {
        name: trimmed,
        lat,
        lon,
        version: version.trim(),
        note: note.trim(),
        updatedAt: now(),
      });
      onDone();
      return;
    }

    if (!force) {
      const hits = await findPostcardDuplicates({ name: trimmed, lat, lon });
      if (hits.length > 0) {
        dupWarning = hits;
        return;
      }
    }

    const t = now();
    await db.postcards.add({
      id: uid(),
      name: trimmed,
      lat,
      lon,
      version: version.trim(),
      note: note.trim(),
      createdAt: t,
      updatedAt: t,
    });
    onDone();
  }

  async function remove() {
    if (!postcard) return;
    const holdingCount = await db.holdings.where('postcardId').equals(postcard.id).count();
    const msg = holdingCount > 0
      ? `刪除 "${postcard.name}" 會同時刪除其 ${holdingCount} 筆持有關聯，確定？`
      : `刪除 "${postcard.name}"？`;
    if (!confirm(msg)) return;
    await db.transaction('rw', db.postcards, db.holdings, async () => {
      await db.holdings.where('postcardId').equals(postcard.id).delete();
      await db.postcards.delete(postcard.id);
    });
    onDone();
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); submit(false); }} class="card">
  <h3>{postcard ? '編輯' : '新增'}明信片</h3>
  <label>
    名稱 *
    <input type="text" bind:value={name} required placeholder="例：京都鴨川夜景" />
  </label>
  <div class="grid-2">
    <label>
      經度
      <input type="text" inputmode="decimal" bind:value={lonStr} placeholder="135.7681" />
    </label>
    <label>
      緯度
      <input type="text" inputmode="decimal" bind:value={latStr} placeholder="35.0116" />
    </label>
  </div>
  <label>
    版本
    <input type="text" bind:value={version} placeholder="例：v1 / 2024 限定" />
  </label>
  <label>
    備註
    <textarea bind:value={note} rows="2"></textarea>
  </label>

  {#if dupWarning.length > 0}
    <div class="warn">
      <strong>找到 {dupWarning.length} 筆相似明信片：</strong>
      <ul>
        {#each dupWarning as d (d.id)}
          <li>{d.name}{d.version ? ` [${d.version}]` : ''} {d.lat !== null && d.lon !== null ? `(${d.lon}, ${d.lat})` : ''}</li>
        {/each}
      </ul>
      <p>仍要新增？</p>
      <div class="actions">
        <button type="button" onclick={() => submit(true)}>強制新增</button>
        <button type="button" onclick={onDone}>取消</button>
      </div>
    </div>
  {:else}
    <div class="actions">
      <button type="submit">{postcard ? '儲存' : '新增'}</button>
      <button type="button" onclick={onDone}>取消</button>
      {#if postcard}
        <button type="button" class="danger delete" onclick={remove}>刪除</button>
      {/if}
    </div>
  {/if}
</form>

<style>
  /* 刪除鈕推到最右，與 儲存/取消 保持距離避免誤觸 */
  .actions .delete {
    margin-left: auto;
  }
</style>
