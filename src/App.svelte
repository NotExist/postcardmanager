<script lang="ts">
  import UsersView from './components/UsersView.svelte';
  import UserDetailView from './components/UserDetailView.svelte';
  import PostcardsView from './components/PostcardsView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import UpdatePrompt from './components/UpdatePrompt.svelte';

  type Tab = 'users' | 'postcards' | 'settings';
  let tab: Tab = $state('users');
  let selectedUserId: string | null = $state(null);

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

<UpdatePrompt />
