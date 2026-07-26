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
  //
  // commit 訊號（刻意「不」在每個 keystroke / compositionend 做 exact match 自動選入：
  // 名稱互為前綴時——如「臺灣」與「臺灣島」——會在打到前綴的瞬間被搶先選走，
  // 較長的目標永遠選不到）：
  //   1. 輸入含空白（含行動版貼上如實落入的情境；先試 exact match 保護
  //      含空白的 display「名稱 · 版本」，不中才走批次比對）
  //   2. Enter
  //   3. 從 datalist 候選點選（原生 change 事件；桌機下拉與行動版鍵盤 chip 都會發，
  //      blur 時若輸入恰為 exact match 也順帶 commit）
  //   4. 「比對加入」按鈕
  function tryCommit(value: string): boolean {
    const id = displayToId.get(value.trim());
    if (!id) return false;
    onPick(id);
    inputValue = '';
    return true;
  }

  $effect(() => {
    if (composing) return;
    if (inputValue && /\s/.test(inputValue)) {
      if (!tryCommit(inputValue)) commitBatch();
    }
  });

  function handleChange() {
    if (!composing) tryCommit(inputValue);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.isComposing || composing) return;
    e.preventDefault();
    if (!tryCommit(inputValue)) commitBatch();
  }

  function handlePaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      e.preventDefault(); // 不進入 input，整批交給 parent 比對
      onPasteTokens(tokens);
    }
  }

  // 行動版 Chrome 的貼上（長按選單、Gboard 剪貼簿 chip）不一定觸發 paste 事件，
  // 文字會如實落進 input。此按鈕是手動觸發的解析入口：把當前 input 內容整批比對。
  // 點按鈕時 IME 組字必然已結束，這裡清 inputValue 不違反上方守則。
  function commitBatch() {
    const tokens = inputValue.split(/\s+/).filter(Boolean);
    inputValue = '';
    if (tokens.length === 0) return;
    onPasteTokens(tokens);
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
      }}
      onchange={handleChange}
      onkeydown={handleKeydown}
      onpaste={handlePaste}
    />
  </label>
  <datalist id={listId}>
    {#each available as p (p.id)}
      <option value={displayOf(p)}>{p.note}</option>
    {/each}
  </datalist>
  {#if inputValue.trim()}
    <div class="batch-row">
      <button type="button" onclick={commitBatch}>比對加入</button>
      <span class="row-meta">把目前輸入整批比對（空白或 Enter 也會觸發）</span>
    </div>
  {/if}
  <div class="row-meta">
    可選 {available.length} 筆
    {#if excludeIds.size > 0}（已排除 {excludeIds.size} 筆已持有/已選）{/if}
  </div>
</div>

<style>
  .picker {
    margin-bottom: 0.5rem;
  }
  .batch-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.375rem;
  }
  .batch-row button {
    padding: 0.25rem 0.625rem;
    font-size: 0.85rem;
  }
</style>
