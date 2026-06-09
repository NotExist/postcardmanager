<script lang="ts">
  import { users } from '../lib/stores';
  import { db, uid, now } from '../lib/db';
  import { findUserDuplicates } from '../lib/dupCheck';
  import type { User } from '../lib/types';

  let displayName = $state('');
  let note = $state('');
  let dupWarning: User[] = $state([]);
  let pendingForce = $state(false);
  let editing: User | null = $state(null);

  async function reset() {
    displayName = '';
    note = '';
    dupWarning = [];
    pendingForce = false;
    editing = null;
  }

  async function submit(force = false) {
    const trimmed = displayName.trim();
    if (!trimmed) return;

    if (editing) {
      await db.users.update(editing.id, {
        displayName: trimmed,
        note: note.trim(),
        updatedAt: now(),
      });
      await reset();
      return;
    }

    if (!force) {
      const hits = await findUserDuplicates({ displayName: trimmed });
      if (hits.length > 0) {
        dupWarning = hits;
        pendingForce = true;
        return;
      }
    }

    const t = now();
    await db.users.add({
      id: uid(),
      displayName: trimmed,
      note: note.trim(),
      createdAt: t,
      updatedAt: t,
    });
    await reset();
  }

  function startEdit(u: User) {
    editing = u;
    displayName = u.displayName;
    note = u.note;
    dupWarning = [];
    pendingForce = false;
  }

  async function remove(u: User) {
    const holdingCount = await db.holdings.where('userId').equals(u.id).count();
    const msg = holdingCount > 0
      ? `刪除 "${u.displayName}" 會同時刪除其 ${holdingCount} 筆持有紀錄，確定？`
      : `刪除 "${u.displayName}"？`;
    if (!confirm(msg)) return;
    await db.transaction('rw', db.users, db.holdings, async () => {
      await db.holdings.where('userId').equals(u.id).delete();
      await db.users.delete(u.id);
    });
    if (editing?.id === u.id) await reset();
  }
</script>

<section>
  <h2>用戶</h2>

  <form onsubmit={(e) => { e.preventDefault(); submit(false); }} class="card">
    <h3>{editing ? '編輯' : '新增'}用戶</h3>
    <label>
      顯示名 *
      <input type="text" bind:value={displayName} required placeholder="例：Alice" />
    </label>
    <label>
      備註
      <textarea bind:value={note} rows="2"></textarea>
    </label>

    {#if dupWarning.length > 0}
      <div class="warn">
        <strong>已有同名用戶 {dupWarning.length} 位：</strong>
        <ul>
          {#each dupWarning as d (d.id)}
            <li>{d.displayName} {d.note ? `(${d.note})` : ''}</li>
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
    {#each $users as u (u.id)}
      <div class="row">
        <div class="row-main">
          <div class="row-title">{u.displayName}</div>
          {#if u.note}<div class="row-sub">{u.note}</div>{/if}
          <div class="row-meta">id: {u.id.slice(0, 8)}…</div>
        </div>
        <div class="row-actions">
          <button onclick={() => startEdit(u)}>編輯</button>
          <button class="danger" onclick={() => remove(u)}>刪除</button>
        </div>
      </div>
    {:else}
      <p class="empty">尚無用戶</p>
    {/each}
  </div>
</section>
