<script lang="ts">
  // 獨立小計數器：與 app 其他資料完全無關。
  // 用 localStorage 而非 cookie 保存：純靜態站沒有伺服器要收 cookie（白白隨每個
  // request 傳送）；localStorage 受 navigator.storage.persist() 保護（cookie 不受、
  // 且有自己的過期/清除規則），API 也單純。清除站點資料時兩者都會消失，行為等價。
  const KEY = 'pm-counter';

  function readInitial(): string {
    try {
      const v = parseInt(localStorage.getItem(KEY) ?? '', 10);
      if (Number.isFinite(v) && v >= 0) return String(v);
    } catch {
      // 讀不到（私密模式等）就從 0 開始
    }
    return '0';
  }

  let text = $state(readInitial());

  function save(v: string) {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // 寫不進就僅存活於本 session
    }
  }

  function current(): number {
    const n = parseInt(text, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function setValue(n: number) {
    text = String(Math.max(0, n));
    save(text);
  }

  function handleInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const digits = el.value.replace(/\D+/g, '').slice(0, 6);
    el.value = digits; // 立即回寫，擋掉非數字字元
    text = digits; // 編輯中允許暫時空白
    if (digits) save(String(parseInt(digits, 10)));
  }

  function handleBlur() {
    setValue(current()); // 空白/前導零在離開欄位時正規化
  }
</script>

<div class="counter">
  <button type="button" onclick={() => setValue(current() - 1)} disabled={current() === 0} aria-label="減一">−</button>
  <input
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    maxlength="6"
    value={text}
    oninput={handleInput}
    onblur={handleBlur}
    aria-label="計數器數值"
  />
  <button type="button" onclick={() => setValue(current() + 1)} aria-label="加一">+</button>
</div>

<style>
  .counter {
    display: inline-flex;
    align-items: stretch;
  }
  .counter button {
    width: 2.1rem;
    padding: 0.4rem 0;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--fg);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .counter button:first-child {
    border-radius: 0.375rem 0 0 0.375rem;
    border-right: 0;
  }
  .counter button:last-child {
    border-radius: 0 0.375rem 0.375rem 0;
    border-left: 0;
  }
  .counter button:disabled {
    color: var(--muted);
    cursor: default;
  }
  .counter input {
    width: 3.2rem;
    margin: 0;
    padding: 0.4rem 0.2rem;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--bg);
    color: var(--fg);
    font-size: 0.9rem;
    text-align: center;
  }
</style>
