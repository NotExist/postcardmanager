<script lang="ts">
  import { postcards } from '../lib/stores';
  import type { Postcard } from '../lib/types';

  interface Props {
    selectedId: string;
    onSelect: (id: string) => void;
    excludeIds?: Set<string>;
  }
  let { selectedId, onSelect, excludeIds = new Set() }: Props = $props();

  let inputValue = $state('');
  const listId = `postcard-picker-${crypto.randomUUID().slice(0, 8)}`;

  const available = $derived($postcards.filter((p) => !excludeIds.has(p.id)));

  function displayOf(p: Postcard): string {
    return p.version ? `${p.name} · ${p.version}` : p.name;
  }

  const displayToId = $derived.by(() => {
    const m = new Map<string, string>();
    for (const p of available) {
      const key = displayOf(p);
      if (!m.has(key)) m.set(key, p.id);
    }
    return m;
  });

  $effect(() => {
    const id = displayToId.get(inputValue);
    if (id && id !== selectedId) onSelect(id);
    else if (!id && selectedId && inputValue.trim() === '') onSelect('');
  });

  $effect(() => {
    if (!selectedId) {
      if (inputValue !== '') inputValue = '';
    }
  });

  const selected = $derived($postcards.find((p) => p.id === selectedId) ?? null);

  function clear() {
    inputValue = '';
    onSelect('');
  }
</script>

<div class="picker">
  <label>
    搜尋明信片（名稱 / 版本）
    <input
      type="text"
      list={listId}
      bind:value={inputValue}
      placeholder={available.length === 0 ? '尚無可選明信片' : '輸入關鍵字或從清單選擇'}
      disabled={available.length === 0}
      autocomplete="off"
    />
  </label>
  <datalist id={listId}>
    {#each available as p (p.id)}
      <option value={displayOf(p)}>{p.note}</option>
    {/each}
  </datalist>
  <div class="row-meta">
    可選 {available.length} 筆
    {#if excludeIds.size > 0}（已排除 {excludeIds.size} 筆已持有）{/if}
  </div>

  {#if selected}
    <div class="selected">
      <div class="row-main">
        <div class="row-title">已選：{selected.name}{selected.version ? ` · ${selected.version}` : ''}</div>
        {#if selected.lat !== null && selected.lon !== null}
          <div class="row-sub">📍 {selected.lon}, {selected.lat}</div>
        {/if}
      </div>
      <button type="button" onclick={clear}>取消選擇</button>
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
    margin-top: 0.5rem;
  }
  .selected .row-main { flex: 1; }
  .selected button { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
</style>
