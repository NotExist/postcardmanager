<script lang="ts">
  import { users, postcards, holdings } from '../lib/stores';
  import { db, uid, now } from '../lib/db';
  import { findHoldingDuplicates, findUserDuplicates, type HoldingDupHit } from '../lib/dupCheck';
  import PostcardPicker from './PostcardPicker.svelte';
  import type { User } from '../lib/types';

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

  let pickedPostcardId = $state('');
  let holdingNote = $state('');
  let holdingDupWarning: HoldingDupHit[] = $state([]);

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

  async function addHolding(force = false) {
    if (!user || !pickedPostcardId) return;

    if (!force) {
      const hits = await findHoldingDuplicates(user.id, pickedPostcardId);
      if (hits.length > 0) {
        holdingDupWarning = hits;
        return;
      }
    }

    await db.holdings.add({
      id: uid(),
      userId: user.id,
      postcardId: pickedPostcardId,
      acquiredAt: now(),
      note: holdingNote.trim(),
    });
    pickedPostcardId = '';
    holdingNote = '';
    holdingDupWarning = [];
  }

  function cancelHolding() {
    holdingDupWarning = [];
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
      <PostcardPicker
        selectedId={pickedPostcardId}
        onSelect={(id) => { pickedPostcardId = id; holdingDupWarning = []; }}
        excludeIds={heldPostcardIds}
      />

      {#if pickedPostcardId}
        <label>
          備註
          <input type="text" bind:value={holdingNote} placeholder="例：2024 京都旅行" />
        </label>

        {#if holdingDupWarning.length > 0}
          <div class="warn">
            <strong>該用戶已持有 {holdingDupWarning.length} 筆相似明信片：</strong>
            <ul>
              {#each holdingDupWarning as d (d.holding.id)}
                <li>[{dupKindLabel(d.kind)}] {d.postcard.name}{d.postcard.version ? ` · ${d.postcard.version}` : ''}</li>
              {/each}
            </ul>
            <p>仍要新增？</p>
            <div class="actions">
              <button type="button" onclick={() => addHolding(true)}>強制新增</button>
              <button type="button" onclick={cancelHolding}>取消</button>
            </div>
          </div>
        {:else}
          <div class="actions">
            <button type="button" onclick={() => addHolding(false)}>新增持有</button>
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
</style>
