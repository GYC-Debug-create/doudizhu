<template>
  <view
    :class="rootClass"
    :style="rootStyle"
    :aria-label="ariaLabel"
    :data-card-index="cardIndex"
    :hover-class="hoverClass || 'none'"
    @tap="$emit('tap', $event)"
    @touchstart="$emit('touchstart', $event)"
    @touchmove="$emit('touchmove', $event)"
    @touchend="$emit('touchend', $event)"
    @touchcancel="$emit('touchcancel', $event)"
    @mousedown="$emit('mousedown', $event)"
    @mousemove="$emit('mousemove', $event)"
    @mouseup="$emit('mouseup', $event)"
  >
    <template v-if="facedown">
      <view class="back-pattern">
        <view class="back-inner">
          <text class="back-emblem">斗</text>
          <text class="back-sub">地主</text>
        </view>
      </view>
    </template>
    <template v-else-if="isDoudizhu && kind === 'hand'">
      <view v-if="card.rank < 16" :class="face.corner">
        <text :class="[face.rank, { double: isTen }]">{{ rankText }}</text>
        <text :class="face.suit">{{ suitText }}</text>
      </view>
      <view v-else class="joker-corner">
        <text class="joker-corner-mark">{{ isBigJoker ? '★' : '☆' }}</text>
      </view>
      <view v-if="card.rank < 11 || card.rank === 14 || card.rank === 15" class="card-pips" :class="pipClass(card)">
        <text v-for="pip in pipCount(card)" :key="pip" class="pip">{{ suitText }}</text>
      </view>
      <view v-else-if="card.rank < 16" class="face-mark">
        <text class="face-letter">{{ rankText }}</text>
        <text class="face-suit">{{ suitText }}</text>
      </view>
      <view v-else class="joker-face" :class="{ large: isBigJoker }">
        <text class="joker-face-label">{{ isBigJoker ? '大王' : '小王' }}</text>
        <text class="joker-face-symbol">{{ isBigJoker ? '★' : '☆' }}</text>
      </view>
      <view v-if="card.rank < 16" :class="[face.corner, 'bottom']">
        <text :class="[face.rank, { double: isTen }]">{{ rankText }}</text>
        <text :class="face.suit">{{ suitText }}</text>
      </view>
    </template>
    <template v-else-if="isDoudizhu">
      <view :class="face.corner">
        <text :class="[face.rank, { double: isTen }]">{{ rankText }}</text>
        <text :class="face.suit">{{ suitText }}</text>
      </view>
      <text :class="face.center">{{ centerText }}</text>
    </template>
    <template v-else>
      <view class="gd-card-corner">
        <text class="gd-card-rank">{{ rankText }}</text>
        <text class="gd-card-suit">{{ suitText }}</text>
      </view>
      <text v-if="wild" class="gd-wild-badge">配</text>
      <text v-else class="gd-card-watermark">{{ centerText }}</text>
    </template>
  </view>
</template>

<script>
/**
 * 单张牌面 —— 两套玩法、7 种尺寸共用一种实现。
 * DOM 结构与 class 名和历史页面完全一致，样式由页面全局样式表提供。
 * 事件不在此处理：父级直接在标签上绑定 tap/touch/mouse，落到根节点。
 */
import { rankChar, suitChar, centerGlyph, isRedCard, pipCount, pipClass } from '../ui/cards-display.js'

const DZ_KINDS = {
  hand: { root: 'card hand-card', corner: 'card-corner hand-corner', rank: 'card-rank', suit: 'card-suit' },
  tiny: { root: 'card tiny', corner: 'card-corner tiny-corner', rank: 'tiny-rank', suit: 'tiny-suit', center: 'tiny-center' },
  mini: { root: 'card mini', corner: 'card-corner mini-corner', rank: 'mini-rank', suit: 'mini-suit', center: 'mini-center' },
  table: { root: 'card table-card-item', corner: 'card-corner table-corner', rank: 'table-rank', suit: 'table-suit', center: 'table-center' },
}

const GD_KINDS = {
  gdHand: { root: 'gd-card gd-hand-card' },
  gdSeat: { root: 'gd-card gd-seat-card' },
  gdTable: { root: 'gd-card gd-table-card' },
}

export default {
  name: 'PlayingCard',
  options: {
    // 小程序端：组件节点虚拟化（避免包裹层破坏 flex 布局）+ 页面样式穿透
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
  emits: ['tap', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mousemove', 'mouseup'],
  props: {
    card: { type: Object, default: null },
    kind: { type: String, default: 'hand' },
    wild: { type: Boolean, default: false },
    sel: { type: Boolean, default: false },
    hinted: { type: Boolean, default: false },
    dim: { type: Boolean, default: false },
    facedown: { type: Boolean, default: false },
    extra: { type: String, default: '' },
    zIndex: { type: Number, default: null },
    cardIndex: { type: Number, default: null },
    hoverClass: { type: String, default: '' },
    ariaLabel: { type: String, default: '' },
  },
  computed: {
    face() {
      return DZ_KINDS[this.kind] || DZ_KINDS.hand
    },
    isDoudizhu() {
      return !!DZ_KINDS[this.kind]
    },
    rootClass() {
      const kindTable = this.isDoudizhu ? DZ_KINDS : GD_KINDS
      const kind = kindTable[this.kind] || (this.isDoudizhu ? DZ_KINDS.hand : GD_KINDS.gdHand)
      const classes = [kind.root]
      if (!this.facedown && this.card && isRedCard(this.card)) classes.push('red')
      if (this.sel) classes.push('sel')
      if (this.hinted) classes.push('hinted')
      if (this.dim) classes.push('dim')
      if (this.wild) classes.push('wild')
      if (this.facedown) classes.push('facedown')
      if (this.extra) classes.push(...this.extra.split(/\s+/).filter(Boolean))
      return classes
    },
    rootStyle() {
      return this.zIndex === null || this.zIndex === undefined ? {} : { zIndex: this.zIndex }
    },
    rankText() {
      return this.card ? rankChar(this.card) : ''
    },
    suitText() {
      return this.card ? suitChar(this.card) : ''
    },
    centerText() {
      return this.card ? centerGlyph(this.card) : ''
    },
    isTen() {
      return this.rankText === '10'
    },
    isBigJoker() {
      return !!this.card && this.card.rank === 17
    },
  },
  methods: {
    pipCount,
    pipClass,
  },
}
</script>
