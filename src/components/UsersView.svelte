<script lang="ts">
  import { users, holdings } from '../lib/stores';
  import { db, uid, now } from '../lib/db';
  import { findUserDuplicates } from '../lib/dupCheck';
  import type { User } from '../lib/types';

  interface Props {
    onOpen: (userId: string) => void;
  }
  let { onOpen }: Props = $props();

  let displayName = $state('');
  let note = $state('');
  let dupWarning: User[] = $state([]);
  let filter = $state('');
  let formOpen = $state(false);

  const holdingCountByUser = $derived.by(() => {
    const m = new Map<string, number>();
    for (const h of $holdings) m.set(h.userId, (m.get(h.userId) ?? 0) + 1);
    return m;
  });

  const filtered = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return $users;
    return $users.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.note.toLowerCase().includes(q),
    );
  });

  function reset() {
    displayName = '';
    note = '';
    dupWarning = [];
    formOpen = false;
  }

  async function submit(force = false) {
    const trimmed = displayName.trim();
    if (!trimmed) return;

    if (!force) {
      const hits = await findUserDuplicates({ displayName: trimmed });
      if (hits.length > 0) {
        dupWarning = hits;
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
    reset();
  }
</script>

<section>
  <h2>用戶</h2>

  {#if formOpen}
    <form onsubmit={(e) => { e.preventDefault(); submit(false); }} class="card">
      <h3>新增用戶</h3>
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
          <button type="submit">新增</button>
          <button type="button" onclick={reset}>取消</button>
        </div>
      {/if}
    </form>
  {:else}
    <button type="button" class="add-toggle" onclick={() => (formOpen = true)}>+ 新增用戶</button>
  {/if}

  <div class="card">
    <label>
      搜尋（顯示名 / 備註）
      <input type="search" bind:value={filter} placeholder="輸入關鍵字過濾" />
    </label>
    <div class="row-meta">{filtered.length} / {$users.length} 筆</div>
  </div>

  <div class="list">
    {#each filtered as u (u.id)}
      <button class="row row-link" type="button" onclick={() => onOpen(u.id)}>
        <div class="row-main">
          <div class="row-title">{u.displayName}</div>
          {#if u.note}<div class="row-sub">{u.note}</div>{/if}
          <div class="row-meta">持有 {holdingCountByUser.get(u.id) ?? 0} 筆</div>
        </div>
        <div class="chev" aria-hidden="true">›</div>
      </button>
    {:else}
      <p class="empty">
        {filter.trim() ? '沒有符合的用戶' : '尚無用戶'}
      </p>
    {/each}
  </div>
</section>

<style>
  .row-link {
    width: 100%;
    text-align: left;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    padding: 0.75rem;
    font: inherit;
  }
  .row-link:hover { border-color: var(--accent); }
  .chev {
    font-size: 1.5rem;
    color: var(--muted);
    align-self: center;
    padding-left: 0.5rem;
  }
  .add-toggle {
    width: 100%;
    padding: 0.6rem;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }
</style>
