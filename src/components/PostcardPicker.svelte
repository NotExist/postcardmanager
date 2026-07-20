<script lang="ts">
  import { postcards } from '../lib/stores';
  import { displayOf } from '../lib/tokenMatch';

  interface Props {
    /** 使用者以輸入/清單選中一張明信片（exact display match） */
    onPick: (id: string) => void;
    /** 貼入含空白分隔的多個 token（≥2 個），整批交給 parent 比對 */
    onPasteTokens: (tokens: string[]) => void;
    excludeIds?: Set<string>;
  }
  let { onPick, onPasteTokens, excludeIds = new Set() }: Props = $props();

  let inputValue = $state('');
  let composing = $state(false);
  const listId = `postcard-picker-${crypto.randomUUID().slice(0, 8)}`;

  const available = $derived($postcards.filter((p) => !excludeIds.has(p.id)));

  const displayToId = $derived.by(() => {
    const m = new Map<string, string>();
    for (const p of available) {
      const key = displayOf(p);
      if (!m.has(key)) m.set(key, p.id);
    }
    return m;
  });

  // IME 守則（39aa1b7 教訓）：組字過程中絕不動 inputValue，否則打斷中日文輸入。
  // 唯一允許清 inputValue 的時機是「exact match 成功 commit、且不在組字中」。
  // compositionstart→end 之間一律不 commit；compositionend 時再補一次檢查
  // （Chrome 的 input event 先於 compositionend，effect 可能在 composing=true 時被跳過）。
  function tryCommit(value: string) {
    const id = displayToId.get(value.trim());
    if (id) {
      onPick(id);
      inputValue = '';
    }
  }

  $effect(() => {
    if (!composing) tryCommit(inputValue);
  });

  function handlePaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      e.preventDefault(); // 不進入 input，整批交給 parent 比對
      onPasteTokens(tokens);
    }
  }
</script>

<div class="picker">
  <label>
    搜尋明信片（名稱 / 版本），或貼入以空白分隔的多個名稱
    <input
      type="text"
      list={listId}
      bind:value={inputValue}
      placeholder={available.length === 0 ? '貼入名稱可批次新增' : '輸入關鍵字、從清單選擇，或貼入多個名稱'}
      autocomplete="off"
      oncompositionstart={() => (composing = true)}
      oncompositionend={(e) => {
        composing = false;
        inputValue = e.currentTarget.value;
        tryCommit(inputValue);
      }}
      onpaste={handlePaste}
    />
  </label>
  <datalist id={listId}>
    {#each available as p (p.id)}
      <option value={displayOf(p)}>{p.note}</option>
    {/each}
  </datalist>
  <div class="row-meta">
    可選 {available.length} 筆
    {#if excludeIds.size > 0}（已排除 {excludeIds.size} 筆已持有/已選）{/if}
  </div>
</div>

<style>
  .picker {
    margin-bottom: 0.5rem;
  }
</style>
