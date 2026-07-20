<script lang="ts">
  import { users, postcards, holdings } from '../lib/stores';
  import { db, uid, now } from '../lib/db';
  import { findHoldingDuplicates, findUserDuplicates, type HoldingDupHit } from '../lib/dupCheck';
  import { matchPostcardTokens, displayOf } from '../lib/tokenMatch';
  import PostcardPicker from './PostcardPicker.svelte';
  import type { User, Postcard } from '../lib/types';

  interface Props {
    userId: string;
    onBack: () => void;
  }
  let { userId, onBack }: Props = $props();

  const user = $derived($users.find((u) => u.id === userId) ?? null);
  const postcardMap = $derived(new Map($postcards.map((p) => [p.id, p])));
  const userHoldings = $derived($holdings.filter((h) => h.userId === userId));
  const heldPostcardIds = $derived(new Set(userHoldings.map((h) => h.postcardId)));

  let editing = $state(false);
  let editName = $state('');
  let editNote = $state('');
  let userDupWarning: User[] = $state([]);

  // 新增持有：多選累積 → 一次寫入
  let selectedIds: string[] = $state([]);
  let holdingNote = $state('');
  let batchDupWarning: { postcard: Postcard; hits: HoldingDupHit[] }[] = $state([]);
  let pasteInfo = $state('');

  // 貼入比對後的待處理項：找不到（待新增）與同名多版本（待選擇）
  let pendingCreates: { name: string; checked: boolean }[] = $state([]);
  let pendingAmbiguous: { token: string; checked: boolean; candidates: Postcard[]; chosenId: string }[] = $state([]);
  const pendingOpen = $derived(pendingCreates.length > 0 || pendingAmbiguous.length > 0);

  const selectedPostcards = $derived(
    selectedIds.map((id) => postcardMap.get(id)).filter((p): p is Postcard => !!p),
  );
  const pickerExclude = $derived(new Set([...heldPostcardIds, ...selectedIds]));

  $effect(() => {
    if (user && !editing) {
      editName = user.displayName;
      editNote = user.note;
    }
  });

  function dupKindLabel(k: HoldingDupHit['kind']): string {
    return k === 'exact' ? '同一張明信片' : k === 'same-name' ? '同名' : '同位置';
  }

  function startEdit() {
    if (!user) return;
    editName = user.displayName;
    editNote = user.note;
    userDupWarning = [];
    editing = true;
  }

  function cancelEdit() {
    editing = false;
    userDupWarning = [];
  }

  async function saveEdit(force = false) {
    if (!user) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    if (!force && trimmed !== user.displayName) {
      const hits = (await findUserDuplicates({ displayName: trimmed })).filter((u) => u.id !== user.id);
      if (hits.length > 0) {
        userDupWarning = hits;
        return;
      }
    }

    await db.users.update(user.id, {
      displayName: trimmed,
      note: editNote.trim(),
      updatedAt: now(),
    });
    editing = false;
    userDupWarning = [];
  }

  async function removeUser() {
    if (!user) return;
    const count = userHoldings.length;
    const msg = count > 0
      ? `刪除 "${user.displayName}" 會同時刪除其 ${count} 筆持有紀錄，確定？`
      : `刪除 "${user.displayName}"？`;
    if (!confirm(msg)) return;
    await db.transaction('rw', db.users, db.holdings, async () => {
      await db.holdings.where('userId').equals(user.id).delete();
      await db.users.delete(user.id);
    });
    onBack();
  }

  function pickPostcard(id: string) {
    if (heldPostcardIds.has(id) || selectedIds.includes(id)) return;
    selectedIds.push(id);
    batchDupWarning = [];
  }

  function removeSelected(id: string) {
    selectedIds = selectedIds.filter((x) => x !== id);
    batchDupWarning = [];
  }

  function handlePasteTokens(tokens: string[]) {
    const res = matchPostcardTokens(tokens, $postcards);

    let added = 0;
    let skipped = 0;
    for (const id of res.matchedIds) {
      if (heldPostcardIds.has(id) || selectedIds.includes(id)) {
        skipped++;
        continue;
      }
      selectedIds.push(id);
      added++;
    }

    // 與既有待處理清單合併（同名/同 token 不重複列）
    for (const name of res.unmatched) {
      if (!pendingCreates.some((c) => c.name === name)) pendingCreates.push({ name, checked: true });
    }
    for (const a of res.ambiguous) {
      if (!pendingAmbiguous.some((x) => x.token === a.token)) {
        pendingAmbiguous.push({ token: a.token, checked: true, candidates: a.candidates, chosenId: a.candidates[0].id });
      }
    }

    const parts = [`貼入 ${tokens.length} 項`];
    if (added) parts.push(`比對加入 ${added} 筆`);
    if (skipped) parts.push(`略過 ${skipped} 筆（已選/已持有）`);
    if (res.ambiguous.length) parts.push(`${res.ambiguous.length} 筆同名多版待選擇`);
    if (res.unmatched.length) parts.push(`${res.unmatched.length} 筆待新增`);
    pasteInfo = parts.join('，');
    batchDupWarning = [];
  }

  // 確認面板：建立勾選的新明信片（僅名稱），連同勾選的同名多版選擇一併併回多選清單。
  // holdings 在此不寫入，仍由「新增持有」按鈕統一送出。
  async function confirmPending() {
    const ts = now();
    const newCards: Postcard[] = pendingCreates
      .filter((c) => c.checked)
      .map((c) => ({
        id: uid(),
        name: c.name,
        lat: null,
        lon: null,
        version: '',
        note: '',
        createdAt: ts,
        updatedAt: ts,
      }));
    if (newCards.length > 0) await db.postcards.bulkAdd(newCards);

    const ambIds = pendingAmbiguous.filter((a) => a.checked).map((a) => a.chosenId);
    const merged = [...newCards.map((p) => p.id), ...ambIds].filter(
      (id) => !selectedIds.includes(id) && !heldPostcardIds.has(id),
    );
    selectedIds = [...selectedIds, ...merged];
    pendingCreates = [];
    pendingAmbiguous = [];
  }

  function cancelPending() {
    pendingCreates = [];
    pendingAmbiguous = [];
  }

  async function addHoldings(force = false) {
    if (!user || selectedIds.length === 0 || pendingOpen) return;

    if (!force) {
      const entries: { postcard: Postcard; hits: HoldingDupHit[] }[] = [];
      for (const id of selectedIds) {
        const hits = await findHoldingDuplicates(user.id, id);
        if (hits.length > 0) {
          const pc = postcardMap.get(id);
          if (pc) entries.push({ postcard: pc, hits });
        }
      }
      if (entries.length > 0) {
        batchDupWarning = entries;
        return;
      }
    }

    const ts = now();
    const note = holdingNote.trim();
    await db.holdings.bulkAdd(
      selectedIds.map((pid) => ({
        id: uid(),
        userId: user.id,
        postcardId: pid,
        acquiredAt: ts,
        note,
      })),
    );
    selectedIds = [];
    holdingNote = '';
    batchDupWarning = [];
    pasteInfo = '';
  }

  function cancelHolding() {
    batchDupWarning = [];
  }

  async function removeHolding(id: string) {
    if (!confirm('刪除此持有關聯？')) return;
    await db.holdings.delete(id);
  }
</script>

<section>
  <div class="back-row">
    <button type="button" class="back" onclick={onBack}>← 用戶列表</button>
  </div>

  {#if !user}
    <p class="empty">用戶不存在（可能已被刪除）</p>
  {:else}
    <div class="card">
      {#if editing}
        <h3>編輯用戶</h3>
        <label>
          顯示名 *
          <input type="text" bind:value={editName} required />
        </label>
        <label>
          備註
          <textarea bind:value={editNote} rows="2"></textarea>
        </label>

        {#if userDupWarning.length > 0}
          <div class="warn">
            <strong>已有同名用戶 {userDupWarning.length} 位：</strong>
            <ul>
              {#each userDupWarning as d (d.id)}
                <li>{d.displayName} {d.note ? `(${d.note})` : ''}</li>
              {/each}
            </ul>
            <p>仍要儲存？</p>
            <div class="actions">
              <button type="button" onclick={() => saveEdit(true)}>強制儲存</button>
              <button type="button" onclick={cancelEdit}>取消</button>
            </div>
          </div>
        {:else}
          <div class="actions">
            <button type="button" onclick={() => saveEdit(false)}>儲存</button>
            <button type="button" onclick={cancelEdit}>取消</button>
          </div>
        {/if}
      {:else}
        <h2 class="user-name">{user.displayName}</h2>
        {#if user.note}<p class="user-note">{user.note}</p>{/if}
        <div class="row-meta">id: {user.id.slice(0, 8)}…</div>
        <div class="actions">
          <button type="button" onclick={startEdit}>編輯</button>
          <button type="button" class="danger" onclick={removeUser}>刪除用戶</button>
        </div>
      {/if}
    </div>

    <div class="card">
      <h3>新增持有</h3>
      <PostcardPicker onPick={pickPostcard} onPasteTokens={handlePasteTokens} excludeIds={pickerExclude} />

      {#if pasteInfo}
        <div class="row-meta">{pasteInfo}</div>
      {/if}

      {#if pendingOpen}
        <div class="warn">
          {#if pendingAmbiguous.length > 0}
            <strong>同名多版本，請選擇：</strong>
            <ul class="pending-list">
              {#each pendingAmbiguous as a (a.token)}
                <li>
                  <label class="pending-item">
                    <input type="checkbox" bind:checked={a.checked} />
                    {a.token}
                  </label>
                  <select bind:value={a.chosenId} disabled={!a.checked}>
                    {#each a.candidates as c (c.id)}
                      <option value={c.id}>{displayOf(c)}</option>
                    {/each}
                  </select>
                </li>
              {/each}
            </ul>
          {/if}
          {#if pendingCreates.length > 0}
            <strong>找不到下列明信片，將建立新明信片（僅名稱，座標/版本可之後補）：</strong>
            <ul class="pending-list">
              {#each pendingCreates as c (c.name)}
                <li>
                  <label class="pending-item">
                    <input type="checkbox" bind:checked={c.checked} />
                    {c.name}
                  </label>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="actions">
            <button type="button" onclick={confirmPending}>確認並加入選擇</button>
            <button type="button" onclick={cancelPending}>全部略過</button>
          </div>
        </div>
      {/if}

      {#if selectedPostcards.length > 0}
        <div class="chips">
          {#each selectedPostcards as p (p.id)}
            <span class="chip">
              {displayOf(p)}
              <button type="button" class="chip-x" onclick={() => removeSelected(p.id)} aria-label="移除 {p.name}">×</button>
            </span>
          {/each}
        </div>

        <label>
          備註（套用到本批全部）
          <input type="text" bind:value={holdingNote} placeholder="例：2024 京都旅行" />
        </label>

        {#if batchDupWarning.length > 0}
          <div class="warn">
            <strong>該用戶已持有相似明信片：</strong>
            <ul>
              {#each batchDupWarning as entry (entry.postcard.id)}
                <li>
                  {displayOf(entry.postcard)} →
                  {#each entry.hits as d, i (d.holding.id)}
                    {i > 0 ? '、' : ''}[{dupKindLabel(d.kind)}] {d.postcard.name}{d.postcard.version ? ` · ${d.postcard.version}` : ''}
                  {/each}
                </li>
              {/each}
            </ul>
            <p>仍要全部新增？</p>
            <div class="actions">
              <button type="button" onclick={() => addHoldings(true)}>強制新增</button>
              <button type="button" onclick={cancelHolding}>取消</button>
            </div>
          </div>
        {:else}
          <div class="actions">
            <button type="button" onclick={() => addHoldings(false)} disabled={pendingOpen}>
              新增持有（{selectedPostcards.length} 筆）
            </button>
            {#if pendingOpen}<span class="row-meta">請先處理上方待確認項目</span>{/if}
          </div>
        {/if}
      {/if}
    </div>

    <h3>持有列表（{userHoldings.length}）</h3>
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
              <div class="row-sub">📍 {pc.lon}, {pc.lat}</div>
            {/if}
            {#if h.note}<div class="row-sub">{h.note}</div>{/if}
            <div class="row-meta">記錄於：{new Date(h.acquiredAt).toLocaleString()}</div>
          </div>
          <div class="row-actions">
            <button class="danger" onclick={() => removeHolding(h.id)}>刪除</button>
          </div>
        </div>
      {:else}
        <p class="empty">尚無持有紀錄</p>
      {/each}
    </div>
  {/if}
</section>

<style>
  .back-row { margin-bottom: 0.75rem; }
  .back {
    background: transparent;
    color: var(--accent);
    border: none;
    padding: 0.25rem 0;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .user-name { margin: 0 0 0.25rem 0; font-size: 1.25rem; }
  .user-note { margin: 0.25rem 0; color: var(--muted); white-space: pre-wrap; }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin: 0.5rem 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 1rem;
    padding: 0.2rem 0.3rem 0.2rem 0.65rem;
    font-size: 0.85rem;
  }
  .chip-x {
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.3rem;
  }
  .chip-x:hover { color: var(--danger, #c00); }

  .pending-list {
    list-style: none;
    padding: 0;
    margin: 0.375rem 0 0.625rem;
  }
  .pending-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.15rem 0;
  }
  .pending-item {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0;
  }
  .pending-item input[type='checkbox'] { width: auto; margin: 0; }
</style>
