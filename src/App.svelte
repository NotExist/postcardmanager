<script lang="ts">
  import { onMount } from 'svelte';
  import UsersView from './components/UsersView.svelte';
  import UserDetailView from './components/UserDetailView.svelte';
  import PostcardsView from './components/PostcardsView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import UpdatePrompt from './components/UpdatePrompt.svelte';

  type Tab = 'users' | 'postcards' | 'settings';
  let tab: Tab = $state('users');
  let selectedUserId: string | null = $state(null);

  // Android 硬體返回鍵防誤觸：進場墊一個 guard history entry。
  // 第一次返回：詳情頁 → 退回列表（重新墊 guard）；否則顯示「再按一次離開」並卸下 guard。
  // 2 秒內第二次返回：已無 guard，交給系統原生處理 → 正常離開/最小化。
  // 逾時未按：墊回 guard 重新武裝。不程式化呼叫 history.back()（standalone PWA
  // 在首個 entry 上是 no-op），離開一律走系統原生路徑。
  let exitArmed = $state(false);
  let exitTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    if (!history.state?.pcGuard) history.pushState({ pcGuard: true }, '');
    const onPop = () => {
      if (selectedUserId) {
        selectedUserId = null;
        history.pushState({ pcGuard: true }, '');
        return;
      }
      exitArmed = true;
      clearTimeout(exitTimer);
      exitTimer = setTimeout(() => {
        exitArmed = false;
        history.pushState({ pcGuard: true }, '');
      }, 2000);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: '用戶' },
    { id: 'postcards', label: '明信片' },
    { id: 'settings', label: '設定' },
  ];

  function switchTab(t: Tab) {
    tab = t;
    selectedUserId = null;
  }
</script>

<header>
  <h1>postcardmemo</h1>
  <nav>
    {#each tabs as t (t.id)}
      <button class:active={tab === t.id} onclick={() => switchTab(t.id)}>{t.label}</button>
    {/each}
  </nav>
</header>

<main>
  {#if tab === 'users'}
    {#if selectedUserId}
      <UserDetailView userId={selectedUserId} onBack={() => (selectedUserId = null)} />
    {:else}
      <UsersView onOpen={(id) => (selectedUserId = id)} />
    {/if}
  {:else if tab === 'postcards'}
    <PostcardsView />
  {:else if tab === 'settings'}
    <SettingsView />
  {/if}
</main>

{#if exitArmed}
  <div class="exit-toast">再按一次返回鍵離開</div>
{/if}

<UpdatePrompt />

<style>
  .exit-toast {
    position: fixed;
    left: 50%;
    bottom: 2rem;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.78);
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 1.25rem;
    font-size: 0.9rem;
    z-index: 100;
    pointer-events: none;
  }
</style>
