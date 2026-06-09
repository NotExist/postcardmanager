<script lang="ts">
  import { postcards } from '../lib/stores';
  import { db, uid, now } from '../lib/db';
  import { findPostcardDuplicates } from '../lib/dupCheck';
  import type { Postcard } from '../lib/types';

  let name = $state('');
  let latStr = $state('');
  let lonStr = $state('');
  let version = $state('');
  let note = $state('');
  let dupWarning: Postcard[] = $state([]);
  let editing: Postcard | null = $state(null);

  function parseCoord(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function reset() {
    name = '';
    latStr = '';
    lonStr = '';
    version = '';
    note = '';
    dupWarning = [];
    editing = null;
  }

  async function submit(force = false) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const lat = parseCoord(latStr);
    const lon = parseCoord(lonStr);

    if (editing) {
      await db.postcards.update(editing.id, {
        name: trimmed,
        lat,
        lon,
        version: version.trim(),
        note: note.trim(),
        updatedAt: now(),
      });
      reset();
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
    reset();
  }

  function startEdit(p: Postcard) {
    editing = p;
    name = p.name;
    latStr = p.lat === null ? '' : String(p.lat);
    lonStr = p.lon === null ? '' : String(p.lon);
    version = p.version;
    note = p.note;
    dupWarning = [];
  }

  async function remove(p: Postcard) {
    const holdingCount = await db.holdings.where('postcardId').equals(p.id).count();
    const msg = holdingCount > 0
      ? `刪除 "${p.name}" 會同時刪除其 ${holdingCount} 筆持有關聯，確定？`
      : `刪除 "${p.name}"？`;
    if (!confirm(msg)) return;
    await db.transaction('rw', db.postcards, db.holdings, async () => {
      await db.holdings.where('postcardId').equals(p.id).delete();
      await db.postcards.delete(p.id);
    });
    if (editing?.id === p.id) reset();
  }
</script>

<section>
  <h2>明信片</h2>

  <form onsubmit={(e) => { e.preventDefault(); submit(false); }} class="card">
    <h3>{editing ? '編輯' : '新增'}明信片</h3>
    <label>
      名稱 *
      <input type="text" bind:value={name} required placeholder="例：京都鴨川夜景" />
    </label>
    <div class="grid-2">
      <label>
        緯度
        <input type="text" inputmode="decimal" bind:value={latStr} placeholder="35.0116" />
      </label>
      <label>
        經度
        <input type="text" inputmode="decimal" bind:value={lonStr} placeholder="135.7681" />
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
            <li>{d.name}{d.version ? ` [${d.version}]` : ''} {d.lat !== null && d.lon !== null ? `(${d.lat}, ${d.lon})` : ''}</li>
          {/each}
        </ul>
        <p>仍要新增？</p>
        <div class="actions">
          <button type="button" onclick={() => submit(true)}>強制新增</button>
          <button type="button" onclick={reset}>取消</button>
        </div>
      </div>
    {:else}
      <div class="actions">
        <button type="submit">{editing ? '儲存' : '新增'}</button>
        {#if editing}
          <button type="button" onclick={reset}>取消</button>
        {/if}
      </div>
    {/if}
  </form>

  <div class="list">
    {#each $postcards as p (p.id)}
      <div class="row">
        <div class="row-main">
          <div class="row-title">{p.name}{p.version ? ` · ${p.version}` : ''}</div>
          {#if p.lat !== null && p.lon !== null}
            <div class="row-sub">📍 {p.lat}, {p.lon}</div>
          {/if}
          {#if p.note}<div class="row-sub">{p.note}</div>{/if}
          <div class="row-meta">id: {p.id.slice(0, 8)}…</div>
        </div>
        <div class="row-actions">
          <button onclick={() => startEdit(p)}>編輯</button>
          <button class="danger" onclick={() => remove(p)}>刪除</button>
        </div>
      </div>
    {:else}
      <p class="empty">尚無明信片</p>
    {/each}
  </div>
</section>
