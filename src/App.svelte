<script lang="ts">
  import UsersView from './components/UsersView.svelte';
  import PostcardsView from './components/PostcardsView.svelte';
  import HoldingsView from './components/HoldingsView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import UpdatePrompt from './components/UpdatePrompt.svelte';

  type Tab = 'holdings' | 'users' | 'postcards' | 'settings';
  let tab: Tab = $state('holdings');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'holdings', label: '持有' },
    { id: 'users', label: '用戶' },
    { id: 'postcards', label: '明信片' },
    { id: 'settings', label: '設定' },
  ];
</script>

<header>
  <h1>postcardmemo</h1>
  <nav>
    {#each tabs as t (t.id)}
      <button class:active={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
    {/each}
  </nav>
</header>

<main>
  {#if tab === 'holdings'}
    <HoldingsView />
  {:else if tab === 'users'}
    <UsersView />
  {:else if tab === 'postcards'}
    <PostcardsView />
  {:else if tab === 'settings'}
    <SettingsView />
  {/if}
</main>

<UpdatePrompt />
