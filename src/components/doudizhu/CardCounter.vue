<template>
  <view class="card-counter" aria-label="记牌器">
    <text class="counter-title">记牌器</text>
    <view class="counter-cells">
      <view
        v-for="cell in cells"
        :key="cell.rank"
        class="counter-cell"
        :class="{ empty: cell.left === 0, hot: cell.hot, joker: cell.rank >= 16 }"
      >
        <text class="counter-rank">{{ cell.label }}</text>
        <text class="counter-left">{{ cell.left }}</text>
      </view>
    </view>
  </view>
</template>

<script>
/** 记牌器：cells 由 ui/doudizhu-view.js 的 counterCells() 算好传入。 */
export default {
  name: 'CardCounter',
  options: { virtualHost: true, styleIsolation: 'apply-shared' },
  props: {
    cells: { type: Array, required: true },
  },
}
</script>

<style>
.card-counter {
  display: flex; align-items: center; gap: 10px;
  width: 100%; box-sizing: border-box;
  margin-top: 8px; padding: 6px 10px;
  border: 1px solid rgba(213,237,221,0.12); border-radius: 10px;
  background: rgba(4,20,17,0.42);
}
.counter-title { color: #c9a45c; font-size: 11px; font-weight: 900; white-space: nowrap; letter-spacing: 1px; }
.counter-cells { display: flex; flex: 1; gap: 3px; min-width: 0; }
.counter-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; min-width: 0; padding: 3px 0; border-radius: 6px;
  background: rgba(240,236,224,0.08);
}
.counter-rank { color: #e8efe9; font-size: 12px; font-weight: 900; line-height: 1.1; }
.counter-left { color: #f0c36b; font-size: 11px; font-weight: 800; line-height: 1.1; }
.counter-cell.joker .counter-rank { color: #ff9a8a; }
.counter-cell.hot { background: rgba(231,90,70,0.22); box-shadow: inset 0 0 0 1px rgba(255,120,100,0.5); }
.counter-cell.hot .counter-left { color: #ffb4a6; }
.counter-cell.empty { opacity: 0.32; }
.counter-cell.empty .counter-left { color: #8aa596; }
@media (max-width: 760px) {
  .card-counter { gap: 6px; padding: 5px 6px; margin-top: 6px; }
  .counter-title { display: none; }
  .counter-rank { font-size: 10px; }
  .counter-left { font-size: 10px; }
}
</style>
