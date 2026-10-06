<template>
  <view v-if="autoPlay" class="autoplay-bar">
    <text class="autoplay-text">🤖 托管中 · AI 正在替你出牌</text>
    <button class="btn ghost autoplay-cancel" hover-class="btn-hover" @tap="$emit('toggle-auto')"><text>取消托管</text></button>
  </view>

  <view v-else class="actions">
    <template v-if="turn.bidTurn">
      <button class="btn primary" hover-class="btn-hover" @tap="$emit('bid')"><text class="btn-symbol">♛</text><text>叫地主</text></button>
      <button class="btn ghost" hover-class="btn-hover" @tap="$emit('bid-pass')"><text class="btn-symbol">×</text><text>不叫</text></button>
    </template>
    <template v-else-if="turn.robTurn">
      <button class="btn primary" hover-class="btn-hover" @tap="$emit('rob')"><text class="btn-symbol">♛</text><text>抢地主</text></button>
      <button class="btn ghost" hover-class="btn-hover" @tap="$emit('rob-pass')"><text class="btn-symbol">×</text><text>不抢</text></button>
    </template>
    <template v-else-if="turn.robPassOnly">
      <button class="btn ghost" hover-class="btn-hover" @tap="$emit('rob-pass')"><text class="btn-symbol">×</text><text>不抢</text></button>
    </template>
    <template v-else-if="turn.playTurn && !canFollow">
      <button class="btn primary cannot-beat" hover-class="btn-hover" @tap="$emit('pass')"><text class="btn-symbol">→</text><text>要不起</text></button>
      <text class="key-tip">没有牌大过上家 · 空格 / P</text>
    </template>
    <template v-else-if="turn.playTurn">
      <button class="btn hint" hover-class="btn-hover" @tap="$emit('hint')"><text class="btn-symbol">✦</text><text>提示</text></button>
      <button class="btn ghost" hover-class="btn-hover" :disabled="turn.mustLead" :class="{ disabled: turn.mustLead }" @tap="$emit('pass')"><text class="btn-symbol">→</text><text>不出</text></button>
      <button class="btn primary" hover-class="btn-hover" :disabled="!canPlay" :class="{ disabled: !canPlay }" aria-label="出牌" @tap="$emit('play')"><text class="btn-symbol">▶</text><text>出牌</text></button>
      <button class="btn ghost auto-btn" hover-class="btn-hover" aria-label="托管" @tap="$emit('toggle-auto')"><text class="btn-symbol">🤖</text><text>托管</text></button>
    </template>
    <view v-else class="waiting-action">
      <view class="waiting-dot" :class="{ pulse: aiThinking }"></view>
      <text class="waiting-text">{{ aiThinking ? 'AI 正在思考' : '等待其他玩家行动' }}</text>
      <button v-if="playing" class="btn ghost auto-btn small" hover-class="btn-hover" @tap="$emit('toggle-auto')"><text class="btn-symbol">🤖</text><text>托管</text></button>
    </view>
  </view>
  <text v-if="!autoPlay && turn.playTurn && canFollow" class="key-tip desktop-only">快捷键：空格/回车 出牌 · P 不出 · H 提示 · Esc 清空</text>
</template>

<script>
/** 斗地主操作区：按轮次显示叫/抢/出牌按钮或托管条。turn 来自 ui/doudizhu-view.js 的 deriveTurn()。 */
export default {
  name: 'ActionBar',
  options: { virtualHost: true, styleIsolation: 'apply-shared' },
  emits: ['bid', 'bid-pass', 'rob', 'rob-pass', 'hint', 'pass', 'play', 'toggle-auto'],
  props: {
    turn: { type: Object, required: true },
    canFollow: { type: Boolean, default: true },
    canPlay: { type: Boolean, default: false },
    autoPlay: { type: Boolean, default: false },
    aiThinking: { type: Boolean, default: false },
    playing: { type: Boolean, default: false },
  },
}
</script>

<style>
.autoplay-bar {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  min-height: 42px; margin-top: 2px; padding: 0 12px;
  border-radius: 10px;
  background: repeating-linear-gradient(135deg, rgba(240,179,75,0.12) 0 12px, rgba(240,179,75,0.04) 12px 24px);
  border: 1px dashed rgba(240,195,107,0.5);
}
.autoplay-text { color: #f3dfb0; font-size: 13px; font-weight: 800; }
.btn.autoplay-cancel { flex: 0 0 auto; height: 32px; }
.btn.auto-btn { opacity: 0.85; }
.btn.auto-btn.small { flex: 0 0 auto; height: 30px; margin-left: 10px; padding: 0 10px; font-size: 12px; }
.btn.cannot-beat { min-width: 160px; background: #6c8a7a; border-color: #8fb3a0; color: #fff; }
.key-tip { display: block; width: 100%; margin-top: 4px; color: #7f9d8d; font-size: 10px; text-align: center; }
.actions .key-tip { width: auto; margin: 0 0 0 6px; align-self: center; }
@media (hover: none), (max-width: 760px) {
  .desktop-only { display: none !important; }
}
</style>
