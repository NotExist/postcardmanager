<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log('SW registered:', swUrl);
    },
    onRegisterError(err) {
      console.error('SW registration error', err);
    },
  });

  function close() {
    offlineReady.set(false);
    needRefresh.set(false);
  }
</script>

{#if $offlineReady || $needRefresh}
  <div class="toast" role="alert">
    {#if $needRefresh}
      <span>有新版本可用</span>
      <button onclick={() => updateServiceWorker(true)}>更新</button>
      <button onclick={close}>稍後</button>
    {:else}
      <span>已就緒，可離線使用</span>
      <button onclick={close}>知道了</button>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: #222;
    color: #fff;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }
  button {
    background: #fff;
    color: #222;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }
</style>
