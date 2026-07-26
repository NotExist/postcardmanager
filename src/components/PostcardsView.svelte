<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { postcards, users, holdings } from '../lib/stores';
  import PostcardForm from './PostcardForm.svelte';

  interface Props {
    onOpenUser: (userId: string) => void;
  }
  let { onOpenUser }: Props = $props();

  let formOpen = $state(false); // 頂部新增表單
  let editingId: string | null = $state(null); // 原位編輯中的明信片 id
  let filter = $state('');
  const expanded = new SvelteSet<string>(); // 展開持有名單的明信片 id

  const filtered = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return $postcards;
    return $postcards.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.version.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q),
    );
  });

  // postcardId → 持有者 userId（去重，依持有紀錄順序）
  const holdersByPostcard = $derived.by(() => {
    const m = new Map<string, string[]>();
    for (const h of $holdings) {
      const list = m.get(h.postcardId);
      if (!list) m.set(h.postcardId, [h.userId]);
      else if (!list.includes(h.userId)) list.push(h.userId);
    }
    return m;
  });
  const userMap = $derived(new Map($users.map((u) => [u.id, u])));

  function openAdd() {
    formOpen = true;
    editingId = null; // 同時間只留一個編輯器
  }

  function startEdit(id: string) {
    editingId = id;
    formOpen = false;
  }

  function toggleExpanded(id: string) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
  }
</script>

<section>
  <h2>明信片</h2>

  {#if formOpen}
    <PostcardForm postcard={null} onDone={() => (formOpen = false)} />
  {:else}
    <button type="button" class="add-toggle" onclick={openAdd}>+ 新增明信片</button>
  {/if}

  <div class="card">
    <label>
      搜尋（名稱 / 版本 / 備註）
      <input type="search" bind:value={filter} placeholder="輸入關鍵字過濾" />
    </label>
    <div class="row-meta">{filtered.length} / {$postcards.length} 筆</div>
  </div>

  <div class="list">
    {#each filtered as p (p.id)}
      {#if editingId === p.id}
        <PostcardForm postcard={p} onDone={() => (editingId = null)} />
      {:else}
        {@const holderIds = holdersByPostcard.get(p.id) ?? []}
        <div class="row">
          <div class="row-main">
            <div class="row-title">{p.name}{p.version ? ` · ${p.version}` : ''}</div>
            {#if p.lat !== null && p.lon !== null}
              <div class="row-sub">📍 {p.lon}, {p.lat}</div>
            {/if}
            {#if p.note}<div class="row-sub">{p.note}</div>{/if}
            <div class="row-meta">id: {p.id.slice(0, 8)}…</div>
            {#if holderIds.length > 0}
              <button type="button" class="holders-toggle" onclick={() => toggleExpanded(p.id)}>
                持有用戶 {holderIds.length} 位 {expanded.has(p.id) ? '▴' : '▾'}
              </button>
              {#if expanded.has(p.id)}
                <div class="holders">
                  {#each holderIds as hid (hid)}
                    <button type="button" class="holder-chip" onclick={() => onOpenUser(hid)}>
                      {userMap.get(hid)?.displayName ?? '(用戶已刪除)'}
                    </button>
                  {/each}
                </div>
              {/if}
            {:else}
              <div class="row-meta">尚無用戶持有</div>
            {/if}
          </div>
          <div class="row-actions">
            <button onclick={() => startEdit(p.id)}>編輯</button>
          </div>
        </div>
      {/if}
    {:else}
      <p class="empty">
        {filter.trim() ? '沒有符合的明信片' : '尚無明信片'}
      </p>
    {/each}
  </div>
</section>

<style>
  .add-toggle {
    width: 100%;
    padding: 0.6rem;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }
  .holders-toggle {
    background: transparent;
    border: none;
    color: var(--accent);
    padding: 0.15rem 0;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .holders {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }
  .holder-chip {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg);
    border-radius: 1rem;
    padding: 0.2rem 0.7rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .holder-chip:hover {
    border-color: var(--accent);
  }
</style>
