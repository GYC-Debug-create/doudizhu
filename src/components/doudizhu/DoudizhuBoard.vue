<template>
  <view class="dz-root">
    <view class="playfield">
      <view class="opp-row">
        <SeatPanel v-bind="seatProps(1)" />

        <view class="center-stage" :class="{ 'my-turn': myActionTurn, 'ai-turn': aiThinking, 'bomb-stage': tableBomb }">
          <view class="phase-line">
            <text class="phase-chip">{{ phase }}</text>
            <text class="round-metrics">底分 {{ snap.baseBet }} · 叫抢 {{ snap.bidMul }} · 炸弹 {{ snap.bombMul }}</text>
          </view>
          <view class="status-block" :class="{ 'my-turn': myActionTurn, 'ai-turn': aiThinking }">
            <view class="status-dot" :class="{ pulse: aiThinking }"><text>{{ aiThinking ? '·' : '•' }}</text></view>
            <view class="status-copy">
              <text class="status">{{ status.text }}</text>
              <text class="status-subtitle">{{ status.subtitle }}</text>
            </view>
          </view>

          <view v-if="bids.length" class="bid-history">
            <text class="bid-history-title">叫抢记录</text>
            <view class="bid-chips">
              <view
                v-for="(h, idx) in bids"
                :key="idx"
                class="bid-chip"
                :class="[h.kind, { 'action-pop': anim.bidAnimSeat === h.seat && idx === bids.length - 1 }]"
              >
                <text class="bid-seat">{{ seatName(h.seat) }}</text>
                <text class="bid-action">{{ h.label }}</text>
              </view>
            </view>
          </view>

          <view v-if="anim.bottomPending" class="bottom-reveal-stage" :class="{ revealed: anim.bottomCards.length }">
            <text class="bottom-reveal-title">{{ anim.bottomCards.length ? '底牌已翻开' : '底牌翻开中' }}</text>
            <view class="bottom-reveal-cards">
              <view v-for="(c, idx) in bottomDisplay" :key="c ? c.id : idx">
                <PlayingCard v-if="c" :card="c" kind="mini" extra="bottom-reveal-card" />
                <PlayingCard v-else kind="mini" extra="bottom-reveal-card facedown noevents" :facedown="true" />
              </view>
            </view>
          </view>
          <view v-else-if="snap.current" :key="trickKey" class="current-trick" :class="{ bomb: tableBomb, enter: anim.trickEnter }">
            <view class="trick-heading">
              <text class="trick-label">台面出牌</text>
              <text class="trick-meta">{{ seatName(snap.current.seat) }} · {{ currentTypeName }} · {{ snap.current.cards.length }}张</text>
            </view>
            <view class="current-cards" :class="{ bomb: tableBomb }">
              <PlayingCard v-for="c in snap.current.cards" :key="c.id" :card="c" kind="table" :extra="tableBomb ? 'bomb noevents' : 'noevents'" />
            </view>
            <text v-if="tableBomb" class="bomb-badge">炸弹 ×{{ snap.bombMul }}</text>
          </view>
          <view v-else class="empty-trick">
            <text class="empty-title">{{ empty.title }}</text>
            <text class="empty-subtitle">{{ empty.subtitle }}</text>
          </view>
        </view>

        <SeatPanel v-bind="seatProps(2)" />
      </view>

      <CardCounter v-if="showCounter && snap.phase === 'play' && !anim.bottomPending" :cells="counter" />

      <view class="self-last" :class="{ enter: anim.playAnimSeat === 0 }">
        <view class="self-last-copy">
          <text class="self-last-label">你的上一手</text>
          <text class="self-last-result">{{ myLastText }}</text>
        </view>
        <view class="last-cards">
          <template v-if="myLast && !myLast.pass">
            <PlayingCard v-for="c in myLast.cards" :key="c.id" :card="c" kind="tiny" extra="noevents" />
          </template>
          <text v-else class="last-cards-empty">牌面记录会显示在这里</text>
        </view>
      </view>
    </view>

    <view class="player-zone" :class="{ active: myActionTurn, 'my-turn': turn.playTurn }">
      <view class="player-toolbar">
        <view class="player-heading">
          <view class="player-avatar"><text>你</text></view>
          <view class="player-copy">
            <text class="player-label">你的手牌</text>
            <text class="player-count">{{ handCards.length }} 张</text>
          </view>
          <view class="role-tag" :class="myRole.cls">{{ myRole.text }}</view>
        </view>
        <view class="selection-summary" :class="{ 'has-selection': selectedIds.length, error: judge.kind === 'error', ok: judge.kind === 'ok' }">
          <text class="selection-count">{{ selectedIds.length ? `${selectedIds.length} 张已选` : '未选牌' }}</text>
          <text class="selection-copy">{{ judge.label }}</text>
        </view>
      </view>

      <view class="hand-shell" :class="{ 'needs-scroll': needsScroll }">
        <view v-if="needsScroll" class="scroll-hint-row">
          <text class="scroll-arrow">‹</text>
          <text class="scroll-tip">{{ handCards.length }} 张 · 可横向滑动查看</text>
          <text class="scroll-arrow">›</text>
          <text v-if="handCards.length > 17" class="scroll-remaining">超出 {{ handCards.length - 17 }} 张可滑动</text>
        </view>
        <view class="hand-viewport">
          <view v-if="needsScroll" class="hand-fade left"></view>
          <view v-if="needsScroll" class="hand-fade right"></view>
          <scroll-view class="hand-scroll" scroll-x="true" :show-scrollbar="false" :scroll-with-animation="false">
            <view class="hand" :class="{ many: handCards.length > 17, 'super-many': handCards.length > 19 }" @mouseup="drag.end($event)">
              <PlayingCard
                v-for="(c, idx) in handCards"
                :key="c.id"
                :card="c"
                kind="hand"
                :sel="selectedIds.includes(c.id)"
                :hinted="hintedIds.includes(c.id)"
                :dim="!turn.playTurn"
                :z-index="selectedIds.includes(c.id) ? 50 : idx"
                :card-index="idx"
                :aria-label="cardLabel(c)"
                hover-class="card-hover"
                @touchstart="drag.start($event, idx)"
                @touchmove="drag.move($event)"
                @touchend="drag.end($event)"
                @touchcancel="drag.end($event)"
                @mousedown="drag.start($event, idx)"
                @mousemove="drag.move($event)"
                @mouseup="drag.end($event)"
                @tap="onCardTap(c.id)"
              />
              <text v-if="!myCards.length" class="hand-empty">本局已结束</text>
            </view>
          </scroll-view>
        </view>
      </view>

      <view class="feedback-row">
        <view class="player-wallet"><text class="player-wallet-label">欢乐豆</text><text class="player-wallet-value">{{ formatBeans(beanBalance) }}</text></view>
        <view class="feedback" :class="judge.kind">
          <text class="feedback-dot" :class="judge.kind"></text>
          <text class="feedback-text">{{ judge.text }}</text>
        </view>
        <button v-if="selectedIds.length" class="link-btn" hover-class="link-btn-hover" aria-label="清空已选牌" @tap="clearSelection">
          <text class="link-btn-text">清空</text>
        </button>
      </view>

      <ActionBar
        :turn="turn"
        :can-follow="canFollow"
        :can-play="judge.canPlay.allowed"
        :auto-play="autoPlay"
        :ai-thinking="aiThinking"
        :playing="snap.phase === 'play'"
        @bid="$emit('bid')"
        @bid-pass="$emit('bid-pass')"
        @rob="$emit('rob')"
        @rob-pass="$emit('rob-pass')"
        @hint="doHint"
        @pass="doPass"
        @play="doPlay"
        @toggle-auto="$emit('toggle-auto')"
      />
    </view>

    <SettleDialog
      v-if="showSettle"
      :mark-class="settle.won ? 'win' : ''"
      :mark-text="settle.won ? '胜' : '负'"
      kicker="本局结算"
      :title="settle.title"
      :subtitle="settle.subtitle"
      :rows="settle.rows"
      :chips="settle.chips"
      :bean-delta="beanDelta"
      action-label="再来一局"
      @action="$emit('restart')"
    />
    <SettleDialog
      v-else-if="snap.overReason === 'no-bid'"
      mark-class="neutral"
      mark-text="—"
      kicker="本局结算"
      title="无人叫地主"
      subtitle="本局作废，马上自动重新发牌"
      action-label="立即重发"
      @action="$emit('restart')"
    />
  </view>
</template>

<script>
/**
 * 斗地主对局面板：只持有本地交互状态（已选/提示牌 + 滑选状态机）。
 * 显示什么全部来自 ui/doudizhu-view.js 的纯函数；引擎动作一律 emit 给页面执行。
 */
import { PHASE } from '../../game/rules.js'
import { analyze, TYPE_NAMES } from '../../game/patterns.js'
import * as view from '../../ui/doudizhu-view.js'
import { keyIntent } from '../../ui/keyboard.js'
import { createDragController, cacheRectsFromDocument, cacheRectsFromUni } from '../../ui/drag-select.js'
import { cardLabel } from '../../ui/cards-display.js'
import { formatBeans } from '../../ui/profile.js'
import PlayingCard from '../PlayingCard.vue'
import SeatPanel from '../SeatPanel.vue'
import SettleDialog from '../SettleDialog.vue'
import CardCounter from './CardCounter.vue'
import ActionBar from './ActionBar.vue'

const AVATARS = ['你', '甲', '乙']

export default {
  name: 'DoudizhuBoard',
  options: {
    // 小程序端：组件节点虚拟化（避免包裹层破坏 flex 布局）+ 页面样式穿透
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
  components: { PlayingCard, SeatPanel, SettleDialog, CardCounter, ActionBar },
  emits: ['play', 'pass', 'hint', 'bid', 'bid-pass', 'rob', 'rob-pass', 'restart', 'toggle-auto'],
  props: {
    snap: { type: Object, required: true },
    seatNames: { type: Array, default: () => [] },
    aiTurnSeat: { type: Number, default: null },
    anim: { type: Object, required: true }, // ui/presenter.js 的展示状态
    trickKey: { type: Number, default: 0 },
    beanBalance: { type: Number, default: 0 },
    beanDelta: { type: Number, default: 0 },
    hintResult: { type: Object, default: null },
    autoPlay: { type: Boolean, default: false },
    showCounter: { type: Boolean, default: true },
    canFollow: { type: Boolean, default: true },
  },

  data() {
    return { selectedIds: [], hintedIds: [] }
  },

  computed: {
    myCards() {
      return (this.snap.players[0] && this.snap.players[0].cards) || []
    },
    /** 底牌翻开动画期间先藏住刚并入的 3 张底牌 */
    handCards() {
      if (!this.anim.bottomPending || !this.snap.bottom) return this.myCards
      const bottomIds = new Set(this.snap.bottom.map((card) => card.id))
      return this.myCards.filter((card) => !bottomIds.has(card.id))
    },
    selectedPattern() {
      if (!this.selectedIds.length) return null
      return analyze(this.myCards.filter((c) => this.selectedIds.includes(c.id)))
    },
    turn() {
      return view.deriveTurn(this.snap, { bottomPending: this.anim.bottomPending })
    },
    myActionTurn() {
      const t = this.turn
      return t.bidTurn || t.robTurn || t.robPassOnly || t.playTurn
    },
    aiThinking() {
      return this.aiTurnSeat !== null && this.aiTurnSeat !== undefined
    },
    judge() {
      return view.judgeSelection(this.snap, this.turn, {
        pattern: this.selectedPattern,
        count: this.selectedIds.length,
        hinted: this.hintedIds.length > 0,
        aiThinking: this.aiThinking,
      })
    },
    status() {
      return view.statusLine(this.snap, this.turn, {
        seatName: this.seatName,
        bottomPending: this.anim.bottomPending,
        finishActive: this.anim.finishActive,
      })
    },
    empty() {
      return view.emptyTable(this.snap, this.turn)
    },
    phase() {
      return view.phaseLabel(this.snap)
    },
    bids() {
      return view.bidEvents(this.snap)
    },
    counter() {
      return view.counterCells(this.snap, this.myCards)
    },
    tableBomb() {
      return view.isBombPattern(this.snap.current && this.snap.current.pattern)
    },
    currentTypeName() {
      const pattern = this.snap.current && this.snap.current.pattern
      return pattern ? TYPE_NAMES[pattern.type] || '出牌' : ''
    },
    bottomDisplay() {
      return this.anim.bottomCards.length ? this.anim.bottomCards : [null, null, null]
    },
    needsScroll() {
      return this.handCards.length > 14
    },
    myLast() {
      return view.lastAction(this.snap, 0)
    },
    myLastText() {
      const a = this.myLast
      if (!a) return '尚未出牌'
      return a.pass ? '不出' : `已出 ${a.cards.length} 张 · ${view.actionTypeName(a)}`
    },
    myRole() {
      if (this.snap.landlordSeat === 0) return { cls: 'landlord', text: '地主' }
      if (this.snap.landlordSeat !== null) return { cls: 'farmer', text: '农民' }
      return { cls: 'pending', text: '待定' }
    },
    settle() {
      return view.settleView(this.snap, this.seatName)
    },
    showSettle() {
      return this.snap.phase === PHASE.OVER && this.snap.overReason === 'finished' && !!this.snap.settle && this.anim.finishDone
    },
  },

  watch: {
    snap() {
      const ids = new Set(this.myCards.map((c) => c.id))
      this.selectedIds = this.selectedIds.filter((id) => ids.has(id))
    },
    hintResult(res) {
      if (!res) return
      const ids = Array.isArray(res.ids) ? res.ids : []
      this.selectedIds = ids.slice()
      this.hintedIds = ids.slice()
      if (!ids.length) {
        uni.showToast({ title: '没有牌大过上家', icon: 'none' })
        return
      }
      const pat = this.selectedPattern
      if (pat) uni.showToast({ title: `建议：${TYPE_NAMES[pat.type]}`, icon: 'none' })
    },
  },

  created() {
    this.drag = createDragController({
      getCards: () => this.handCards,
      getSelection: () => this.selectedIds,
      setSelection: (ids) => {
        this.selectedIds = ids
      },
      clearHints: () => {
        this.hintedIds = []
      },
      isInteractive: () => this.turn.playTurn,
      selector: '.hand-card',
      cacheRects: (selector) => (typeof document !== 'undefined' ? cacheRectsFromDocument(selector) : cacheRectsFromUni(selector)),
    })
  },

  mounted() {
    if (typeof document === 'undefined') return
    this.docHandlers = {
      key: (event) => this.onKey(event),
      down: (event) => this.onDocMouseDown(event),
      move: (event) => this.drag.selecting && this.drag.move(event),
      up: (event) => this.drag.selecting && this.drag.end(event),
    }
    document.addEventListener('keydown', this.docHandlers.key)
    document.addEventListener('mousedown', this.docHandlers.down)
    document.addEventListener('mousemove', this.docHandlers.move)
    document.addEventListener('mouseup', this.docHandlers.up)
  },

  beforeUnmount() {
    if (typeof document !== 'undefined' && this.docHandlers) {
      document.removeEventListener('keydown', this.docHandlers.key)
      document.removeEventListener('mousedown', this.docHandlers.down)
      document.removeEventListener('mousemove', this.docHandlers.move)
      document.removeEventListener('mouseup', this.docHandlers.up)
      this.docHandlers = null
    }
    if (this.drag) this.drag.reset()
  },

  methods: {
    formatBeans,
    cardLabel,
    seatName(seat) {
      return this.seatNames[seat] || `座位${seat}`
    },
    /** 对手座位面板的全部入参 */
    seatProps(seat) {
      const s = this.snap
      const active = view.isSeatActive(s, seat)
      const player = s.players[seat]
      const bid = view.lastBid(s, seat)
      return {
        name: this.seatName(seat),
        avatar: AVATARS[seat],
        role: view.roleLabel(s, seat),
        landlord: s.landlordSeat === seat,
        active,
        thinking: this.aiThinking && active,
        count: (player && player.cardCount) || 0,
        bidLabel: bid.label,
        bidKind: bid.kind,
        bidPop: this.anim.bidAnimSeat === seat,
        playedAction: view.lastAction(s, seat),
        finishRevealActive: this.anim.finishActive,
        remaining: player && Array.isArray(player.cards) ? player.cards : [],
        playAnim: this.anim.playAnimSeat === seat,
        alert: view.seatAlert(s, seat),
      }
    },

    onKey(event) {
      if (!event || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const tag = event.target && event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.querySelector('.mask')) return
      if (this.autoPlay) return
      const intent = keyIntent(event.key, {
        ...this.turn,
        canFollow: this.canFollow,
        hasSelection: this.selectedIds.length > 0,
      })
      if (!intent) return
      event.preventDefault()
      const actions = {
        bid: () => this.$emit('bid'),
        'bid-pass': () => this.$emit('bid-pass'),
        rob: () => this.$emit('rob'),
        'rob-pass': () => this.$emit('rob-pass'),
        play: () => this.doPlay(),
        pass: () => this.doPass(),
        hint: () => this.doHint(),
        clear: () => this.clearSelection(),
      }
      actions[intent]()
    },
    onDocMouseDown(event) {
      if (!event || event.button !== 0 || !event.target) return
      const element = event.target.closest ? event.target : event.target.parentElement
      const card = element && element.closest ? element.closest('.hand-card') : null
      if (!card) return
      const index = Number(card.dataset.cardIndex)
      if (Number.isInteger(index)) this.drag.start(event, index)
    },
    onCardTap(id) {
      if (this.drag.shouldIgnoreTap()) return
      if (!this.turn.playTurn) {
        if (this.snap.phase === PHASE.BID) uni.showToast({ title: '叫地主阶段不能选牌', icon: 'none' })
        return
      }
      const i = this.selectedIds.indexOf(id)
      this.hintedIds = []
      if (i >= 0) this.selectedIds.splice(i, 1)
      else this.selectedIds.push(id)
    },
    clearSelection() {
      this.selectedIds = []
      this.hintedIds = []
    },
    doHint() {
      if (!this.turn.playTurn) {
        uni.showToast({ title: '未轮到你出牌', icon: 'none' })
        return
      }
      this.$emit('hint')
    },
    doPlay() {
      const { canPlay } = this.judge
      if (!canPlay.allowed) {
        uni.showToast({ title: canPlay.reason || '压不过上家', icon: 'none' })
        return
      }
      this.$emit('play', this.myCards.filter((c) => this.selectedIds.includes(c.id)))
    },
    doPass() {
      if (this.turn.mustLead) {
        uni.showToast({ title: '新一轮必须出牌', icon: 'none' })
        return
      }
      this.$emit('pass')
    },
  },
}
</script>
