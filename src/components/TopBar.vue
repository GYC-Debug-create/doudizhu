<template>
  <view class="topbar">
    <view class="brand-block">
      <view class="brand-mark"><text class="brand-mark-glyph">♠</text></view>
      <view class="brand-copy">
        <text class="brand-title">{{ title }}</text>
        <text class="brand-subtitle">{{ subtitle }}</text>
      </view>
    </view>

    <view class="table-meta">
      <view class="meta-group">
        <text class="meta-label">{{ guandan ? '当前级牌' : '本局倍数' }}</text>
        <text class="meta-value">{{ guandan ? levelLabel : `${totalMul}×` }}</text>
      </view>
      <view v-if="!guandan" class="bottom-reveal">
        <text class="bottom-label">底牌</text>
        <view class="bottom-stack" :class="{ revealed: bottomCards.length, flipping: bottomFlip }">
          <template v-if="bottomCards.length">
            <PlayingCard v-for="c in bottomCards" :key="c.id" :card="c" kind="mini" extra="reveal-card noevents" />
          </template>
          <template v-else>
            <PlayingCard v-for="i in 3" :key="i" kind="mini" extra="facedown noevents" :facedown="true" />
          </template>
        </view>
      </view>
      <view v-else class="gd-header-note">
        <text class="gd-heart">♥</text>
        <text>{{ `红桃${levelLabel}配牌` }}</text>
      </view>

      <view class="stats-pill" :title="`胜率 ${winRate}`">
        <text class="stats-label">战绩</text>
        <text class="stats-value">{{ stats.wins }}胜{{ stats.games - stats.wins }}负</text>
        <text v-if="stats.streak >= 2" class="stats-streak">{{ stats.streak }}连胜</text>
      </view>
      <button class="icon-btn" :class="{ off: !soundOn }" hover-class="icon-btn-hover" :aria-label="soundOn ? '关闭声音' : '开启声音'" :title="soundOn ? '声音：开（点击关闭）' : '声音：关（点击开启）'" @tap="$emit('toggle-sound')">
        <text class="icon-glyph">{{ soundOn ? '🔊' : '🔇' }}</text>
      </button>
      <button class="icon-btn speed-btn" hover-class="icon-btn-hover" aria-label="切换出牌速度" :title="`AI 出牌速度：${speedLabel}（点击切换）`" @tap="$emit('cycle-speed')">
        <text class="icon-text">{{ speedLabel }}</text>
      </button>
      <button v-if="!guandan" class="icon-btn" :class="{ off: !showCounter }" hover-class="icon-btn-hover" aria-label="记牌器" :title="showCounter ? '记牌器：开' : '记牌器：关'" @tap="$emit('toggle-counter')">
        <text class="icon-text">记</text>
      </button>
      <button class="icon-btn" hover-class="icon-btn-hover" aria-label="重新开始" title="重新开始" @tap="$emit('restart')">
        <text class="icon-glyph">↻</text>
      </button>
    </view>
  </view>
</template>

<script>
/** 顶栏：标题、倍数/级牌、底牌、战绩与设置按钮。纯展示，操作全部 emit。 */
import PlayingCard from './PlayingCard.vue'
import { winRate } from '../ui/profile.js'

export default {
  name: 'TopBar',
  options: { virtualHost: true, styleIsolation: 'apply-shared' },
  components: { PlayingCard },
  emits: ['toggle-sound', 'cycle-speed', 'toggle-counter', 'restart'],
  props: {
    guandan: { type: Boolean, default: false },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    totalMul: { type: Number, default: 1 },
    levelLabel: { type: String, default: '' },
    bottomCards: { type: Array, default: () => [] },
    bottomFlip: { type: Boolean, default: false },
    stats: { type: Object, required: true },
    soundOn: { type: Boolean, default: true },
    speedLabel: { type: String, default: '中' },
    showCounter: { type: Boolean, default: true },
  },
  computed: {
    winRate() {
      return winRate(this.stats)
    },
  },
}
</script>

<style>
.icon-btn.off { opacity: 0.45; }
.icon-text { font-size: 13px; font-weight: 800; color: #f3dfb0; }
.speed-btn .icon-text { color: #9fe0b8; }

.stats-pill {
  display: flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 10px; box-sizing: border-box;
  border: 1px solid rgba(229,239,229,0.18); border-radius: 8px;
  background: rgba(8,25,22,0.32);
  flex-shrink: 0;
}
.stats-label { color: #9bb9a8; font-size: 10px; font-weight: 800; }
.stats-value { color: #f6f1e6; font-size: 12px; font-weight: 800; }
.stats-streak {
  padding: 2px 6px; border-radius: 999px;
  background: linear-gradient(90deg, #f0b34b, #f27d4a); color: #2b1606;
  font-size: 10px; font-weight: 900;
}
@media (max-width: 760px) {
  .stats-pill { display: none; }
}
</style>
