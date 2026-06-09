<script lang="ts">
  import { users, postcards, holdings } from '../lib/stores';
  import { db, uid, now } from '../lib/db';
  import { findHoldingDuplicates, type HoldingDupHit } from '../lib/dupCheck';

  let selectedUserId = $state('');
  let selectedPostcardId = $state('');
  let holdingNote = $state('');
  let dupWarning: HoldingDupHit[] = $state([]);

  const userMap = $derived(new Map($users.map((u) => [u.id, u])));
  const postcardMap = $derived(new Map($postcards.map((p) => [p.id, p])));

  const userHoldings = $derived(
    selectedUserId
      ? $holdings.filter((h) => h.userId === selectedUserId)
      : [],
  );

  function dupKindLabel(k: HoldingDupHit['kind']): string {
    return k === 'exact' ? '同一張明信片' : k === 'same-name' ? '同名' : '同位置';
  }

  async function addHolding(force = false) {
    if (!selectedUserId || !selectedPostcardId) return;

    if (!force) {
      const hits = await findHoldingDuplicates(selectedUserId, selectedPostcardId);
      if (hits.length > 0) {
        dupWarning = hits;
        return;
      }
    }

    await db.holdings.add({
      id: uid(),
      userId: selectedUserId,
      postcardId: selectedPostcardId,
      acquiredAt: now(),
      note: holdingNote.trim(),
    });
    selectedPostcardId = '';
    holdingNote = '';
    dupWarning = [];
  }

  function cancel() {
    dupWarning = [];
  }

  async function remove(id: string) {
    if (!confirm('刪除此持有關聯？')) return;
    await db.holdings.delete(id);
  }
</script>

<section>
  <h2>持有關聯</h2>

  <div class="card">
    <label>
      選擇用戶
      <select bind:value={selectedUserId} onchange={() => { dupWarning = []; selectedPostcardId = ''; }}>
        <option value="">-- 選擇 --</option>
        {#each $users as u (u.id)}
          <option value={u.id}>{u.displayName}</option>
        {/each}
      </select>
    </label>

    {#if selectedUserId}
      <h3>新增持有</h3>
      <label>
        明信片
        <select bind:value={selectedPostcardId} onchange={() => { dupWarning = []; }}>
          <option value="">-- 選擇 --</option>
          {#each $postcards as p (p.id)}
            <option value={p.id}>{p.name}{p.version ? ` · ${p.version}` : ''}</option>
          {/each}
        </select>
      </label>
      <label>
        備註
        <input type="text" bind:value={holdingNote} placeholder="例：2024 京都旅行" />
      </label>

      {#if dupWarning.length > 0}
        <div class="warn">
          <strong>該用戶已持有 {dupWarning.length} 筆相似明信片：</strong>
          <ul>
            {#each dupWarning as d (d.holding.id)}
              <li>[{dupKindLabel(d.kind)}] {d.postcard.name}{d.postcard.version ? ` · ${d.postcard.version}` : ''}</li>
            {/each}
          </ul>
          <p>仍要新增？</p>
          <div class="actions">
            <button type="button" onclick={() => addHolding(true)}>強制新增</button>
            <button type="button" onclick={cancel}>取消</button>
          </div>
        </div>
      {:else}
        <div class="actions">
          <button type="button" onclick={() => addHolding(false)} disabled={!selectedPostcardId}>新增持有</button>
        </div>
      {/if}
    {/if}
  </div>

  {#if selectedUserId}
    <h3>{userMap.get(selectedUserId)?.displayName} 的持有 ({userHoldings.length})</h3>
    <div class="list">
      {#each userHoldings as h (h.id)}
        {@const pc = postcardMap.get(h.postcardId)}
        <div class="row">
          <div class="row-main">
            <div class="row-title">
              {pc ? pc.name : '(明信片已被刪除)'}
              {#if pc?.version}<span class="badge">{pc.version}</span>{/if}
            </div>
            {#if pc && pc.lat !== null && pc.lon !== null}
              <div class="row-sub">📍 {pc.lat}, {pc.lon}</div>
            {/if}
            {#if h.note}<div class="row-sub">{h.note}</div>{/if}
            <div class="row-meta">取得：{new Date(h.acquiredAt).toLocaleString()}</div>
          </div>
          <div class="row-actions">
            <button class="danger" onclick={() => remove(h.id)}>刪除</button>
          </div>
        </div>
      {:else}
        <p class="empty">尚無持有紀錄</p>
      {/each}
    </div>
  {/if}
</section>
