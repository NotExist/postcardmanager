<script lang="ts">
  import { postcards } from '../lib/stores';
  import type { Postcard } from '../lib/types';

  interface Props {
    selectedId: string;
    onSelect: (id: string) => void;
    excludeIds?: Set<string>;
  }
  let { selectedId, onSelect, excludeIds = new Set() }: Props = $props();

  let query = $state('');
  const MAX_RESULTS = 20;

  const selected = $derived($postcards.find((p) => p.id === selectedId) ?? null);

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const all = q
      ? $postcards.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.version.toLowerCase().includes(q) ||
            p.note.toLowerCase().includes(q),
        )
      : $postcards;
    return all.slice(0, MAX_RESULTS);
  });

  function pick(p: Postcard) {
    onSelect(p.id);
    query = '';
  }

  function clearSelection() {
    onSelect('');
  }
</script>

<div class="picker">
  {#if selected}
    <div class="selected">
      <div class="row-main">
        <div class="row-title">{selected.name}{selected.version ? ` · ${selected.version}` : ''}</div>
        {#if selected.lat !== null && selected.lon !== null}
          <div class="row-sub">📍 {selected.lon}, {selected.lat}</div>
        {/if}
      </div>
      <button type="button" onclick={clearSelection}>取消選擇</button>
    </div>
  {:else}
    <label>
      搜尋明信片（名稱 / 版本 / 備註）
      <input type="search" bind:value={query} placeholder="輸入關鍵字過濾" />
    </label>
    <div class="row-meta">{matches.length} 筆顯示（共 {$postcards.length}）</div>
    <div class="matches">
      {#each matches as p (p.id)}
        {@const disabled = excludeIds.has(p.id)}
        <button
          type="button"
          class="match"
          class:disabled
          onclick={() => !disabled && pick(p)}
          aria-disabled={disabled}
        >
          <div class="row-title">{p.name}{p.version ? ` · ${p.version}` : ''}</div>
          {#if p.lat !== null && p.lon !== null}
            <div class="row-sub">📍 {p.lon}, {p.lat}</div>
          {/if}
          {#if disabled}<div class="row-meta">已持有</div>{/if}
        </button>
      {:else}
        <p class="empty">{$postcards.length === 0 ? '尚無明信片' : '無符合項目'}</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker { margin-bottom: 0.5rem; }
  .selected {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
  }
  .selected .row-main { flex: 1; }
  .selected button { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
  .matches {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 320px;
    overflow-y: auto;
    margin-top: 0.5rem;
  }
  .match {
    text-align: left;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    color: var(--fg);
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font: inherit;
    width: 100%;
  }
  .match:hover { border-color: var(--accent); }
  .match.disabled { opacity: 0.5; cursor: not-allowed; }
  .match.disabled:hover { border-color: var(--border); }
</style>
