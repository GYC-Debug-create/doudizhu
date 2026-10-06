<template>
  <view class="opp" :class="{ active, landlord, thinking, alerting: !!alert }">
    <view class="seat-head">
      <view class="avatar"><text class="avatar-letter">{{ avatar }}</text></view>
      <view class="seat-copy">
        <text class="opp-name">{{ name }}</text>
        <text class="opp-role" :class="{ landlord }">{{ role }}</text>
      </view>
      <view v-if="active" class="turn-badge" :class="{ ai: thinking }">
        <text class="turn-dot">●</text>
        <text class="turn-text">{{ thinking ? '思考' : '行动' }}</text>
      </view>
    </view>
    <view class="seat-meta">
      <view class="count-pill"><text class="count-number">{{ count }}</text><text class="count-unit">张</text></view>
      <text v-if="alert" class="low-alert" :class="{ single: alert === '报单' }">⚠ {{ alert }}</text>
      <text v-if="bidLabel" class="bubble" :class="[bidKind, { 'action-pop': bidPop }]">{{ bidLabel }}</text>
    </view>
    <view v-if="finishRevealActive && remaining.length" class="remaining-hand" :class="{ enter: playAnim }">
      <view class="remaining-heading"><text>剩余手牌</text><text>{{ remaining.length }} 张</text></view>
      <view class="remaining-cards">
        <PlayingCard
          v-for="c in remaining"
          :key="c.id"
          :card="c"
          kind="tiny"
          extra="remaining-card noevents"
        />
      </view>
    </view>
    <view v-else class="played" :class="{ bomb: isBomb, enter: playAnim }">
      <template v-if="playedAction && !playedAction.pass">
        <PlayingCard v-for="c in playedAction.cards" :key="c.id" :card="c" kind="tiny" extra="noevents" />
      </template>
      <text v-else-if="playedAction" class="passtag">不出</text>
      <text v-else class="played-empty">上一手</text>
    </view>
    <view v-if="thinking" class="thinking-line">
      <view class="thinking-dot pulse"></view>
      <text class="thinking-text">AI 思考中</text>
    </view>
  </view>
</template>

<script>
/**
 * 斗地主对手座位（上/下两家共用），纯展示：牌局数据全部由父级算好传入。
 */
import { T } from '../game/patterns.js'
import PlayingCard from './PlayingCard.vue'

export default {
  name: 'SeatPanel',
  options: {
    // 小程序端：组件节点虚拟化（避免包裹层破坏 flex 布局）+ 页面样式穿透
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
  components: { PlayingCard },
  props: {
    name: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, default: '' },
    landlord: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    thinking: { type: Boolean, default: false },
    count: { type: Number, default: 0 },
    bidLabel: { type: String, default: '' },
    bidKind: { type: String, default: 'neutral' },
    bidPop: { type: Boolean, default: false },
    playedAction: { type: Object, default: null },
    finishRevealActive: { type: Boolean, default: false },
    remaining: { type: Array, default: () => [] },
    playAnim: { type: Boolean, default: false },
    alert: { type: String, default: '' },
  },
  computed: {
    isBomb() {
      const pattern = this.playedAction && this.playedAction.pattern
      return !!pattern && (pattern.type === T.BOMB || pattern.type === T.ROCKET)
    },
  },
}
</script>

<style>
/* 报单 / 报双 */
.low-alert {
  padding: 2px 8px; border-radius: 999px;
  background: #d9534f; color: #fff; font-size: 11px; font-weight: 900;
  animation: low-alert-pulse 0.9s ease-in-out infinite;
}
.low-alert.single { background: #ff3b30; }
.opp.alerting { box-shadow: 0 0 0 1px rgba(255,80,60,0.55), 0 0 22px rgba(255,70,50,0.18); }
@keyframes low-alert-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.12); opacity: 0.75; }
}
</style>
