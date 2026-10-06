<template>
  <view class="guandan-board">
    <view class="guandan-scorebar">
      <view class="gd-team-score team-a">
        <text class="gd-team-name">我方</text>
        <text class="gd-team-level">打 {{ levelChar(snap.teamLevels[0]) }}</text>
      </view>
      <view class="gd-round-copy">
        <text class="gd-round-title">掼蛋 · {{ levelLabel }} 级</text>
        <text class="gd-round-note">{{ wildLabel }}</text>
      </view>
      <view class="gd-team-score team-b">
        <text class="gd-team-name">对手</text>
        <text class="gd-team-level">打 {{ levelChar(snap.teamLevels[1]) }}</text>
      </view>
    </view>
    <text v-if="tributeText" class="gd-tribute-note">{{ tributeText }}</text>

    <view class="guandan-stage">
      <view
        v-for="seat in sideSeats"
        :key="seat"
        :class="[`gd-seat gd-seat-${seat}`, { active: isActive(seat), teammate: teamOf(seat) === 0 }]"
      >
        <view class="gd-seat-head">
          <view class="gd-avatar"><text>{{ avatarText(seat) }}</text></view>
          <view class="gd-seat-copy">
            <text class="gd-seat-name">{{ seatName(seat) }}</text>
            <text class="gd-seat-role">{{ teamOf(seat) === 0 ? '队友' : '对手' }}</text>
          </view>
          <view v-if="isActive(seat)" class="gd-turn-badge"><text>●</text><text>行动</text></view>
        </view>
        <view class="gd-seat-info">
          <text class="gd-count">{{ cardCount(seat) }} 张</text>
          <text v-if="lastAction(seat)" class="gd-action-label">{{ actionLabel(seat) }}</text>
          <text v-else class="gd-action-label muted">等待出牌</text>
        </view>
        <view v-if="finishRevealActive && remainingCards(seat).length" class="gd-seat-played gd-remaining-played" :class="{ active: snap.current && snap.current.seat === seat, enter: playAnimSeat === seat }">
          <view class="gd-remaining-heading"><text>剩余手牌</text><text>{{ remainingCards(seat).length }} 张</text></view>
          <view class="gd-remaining-cards">
            <PlayingCard
              v-for="c in remainingCards(seat)"
              :key="c.id"
              :card="c"
              kind="gdSeat"
              :wild="isWild(c)"
            />
          </view>
        </view>
        <view v-else-if="lastPlay(seat)" class="gd-seat-played" :class="{ active: snap.current && snap.current.seat === seat, enter: playAnimSeat === seat }">
          <PlayingCard
            v-for="c in lastPlay(seat).cards"
            :key="c.id"
            :card="c"
            kind="gdSeat"
            :wild="isWild(c)"
          />
        </view>
      </view>

      <view class="gd-center-stage" :class="{ active: myTurn, bomb: isBomb }">
        <view class="gd-phase-line">
          <text class="phase-chip">出牌中</text>
          <text class="round-metrics">红桃{{ levelLabel }}配牌</text>
        </view>
        <view class="gd-status-block" :class="{ active: myTurn }">
          <view class="gd-status-dot" :class="{ pulse: !myTurn }"><text>•</text></view>
          <view class="gd-status-copy">
            <text class="gd-status">{{ statusText }}</text>
            <text class="gd-status-subtitle">{{ statusSubtitle }}</text>
          </view>
        </view>
        <view v-if="snap.current" class="gd-current-trick" :class="{ bomb: isBomb }" :key="trickKey">
          <view class="gd-trick-heading">
            <text class="gd-trick-label">本轮最大牌</text>
            <text class="gd-trick-meta">{{ seatName(snap.current.seat) }} · {{ currentTypeName }}</text>
          </view>
          <view class="gd-current-cards">
            <PlayingCard
              v-for="c in snap.current.cards"
              :key="c.id"
              :card="c"
              kind="gdTable"
              :wild="isWild(c)"
            />
          </view>
          <text v-if="isBomb" class="bomb-badge">炸弹</text>
        </view>
        <view v-else class="gd-empty-trick">
          <text class="empty-title">新一轮开始</text>
          <text class="empty-subtitle">轮到当前玩家领出</text>
        </view>
      </view>
    </view>

    <view class="player-zone guandan-player-zone" :class="{ active: myTurn, 'my-turn': myTurn }">
      <view class="player-toolbar">
        <view class="player-heading">
          <view class="player-avatar"><text>你</text></view>
          <view class="player-copy">
            <text class="player-label">你的手牌</text>
            <text class="player-count">{{ myCards.length }} 张 · 我方</text>
          </view>
          <view class="role-tag farmer">队友：AI·队友</view>
        </view>
        <view class="selection-summary" :class="{ 'has-selection': selectedIds.length, error: feedbackKind === 'error', ok: feedbackKind === 'ok' }">
          <text class="selection-count">{{ selectedIds.length ? `${selectedIds.length} 张已选` : '未选牌' }}</text>
          <text class="selection-copy">{{ selectionText }}</text>
        </view>
      </view>

      <view class="gd-hand-shell">
        <view class="scroll-hint-row" :class="{ 'has-player-play': lastPlay(0), enter: playAnimSeat === 0 }">
          <template v-if="lastPlay(0)">
            <text class="gd-player-played-label">你的上一手</text>
            <view class="gd-player-played-cards">
              <PlayingCard
                v-for="c in lastPlay(0).cards"
                :key="c.id"
                :card="c"
                kind="gdSeat"
                :wild="isWild(c)"
              />
            </view>
          </template>
          <template v-else>
            <text class="scroll-arrow">‹</text><text class="scroll-tip">{{ myCards.length }} 张 · 可横向滑动查看</text><text class="scroll-arrow">›</text>
          </template>
        </view>
        <view class="gd-hand-viewport">
          <scroll-view class="gd-hand-scroll" scroll-x="true" :show-scrollbar="false" :scroll-with-animation="false">
            <view class="gd-hand" @mouseup="onHandMouseUp">
              <PlayingCard
                v-for="(c, idx) in myCards"
                :key="c.id"
                :card="c"
                kind="gdHand"
                :wild="isWild(c)"
                :sel="selectedIds.includes(c.id)"
                :hinted="hintedIds.includes(c.id)"
                :dim="!myTurn"
                :z-index="selectedIds.includes(c.id) ? 50 : idx"
                :card-index="idx"
                :aria-label="cardLabel(c)"
                hover-class="gd-card-hover"
                @touchstart="onCardDragStart($event, idx)"
                @touchmove="onCardDragMove"
                @touchend="onCardDragEnd"
                @touchcancel="onCardDragEnd"
                @mousedown="onCardDragStart($event, idx)"
                @mousemove="onCardDragMove"
                @mouseup="onCardDragEnd"
                @tap="onCardTap(c.id)"
              />
            </view>
          </scroll-view>
        </view>
      </view>

      <view class="feedback-row">
        <view class="player-wallet"><text class="player-wallet-label">欢乐豆</text><text class="player-wallet-value">{{ formatBeans(beanBalance) }}</text></view>
        <view class="feedback" :class="feedbackKind">
          <text class="feedback-dot" :class="feedbackKind"></text>
          <text class="feedback-text">{{ feedbackText }}</text>
        </view>
        <button v-if="selectedIds.length" class="link-btn" hover-class="link-btn-hover" @tap="clearSelection" aria-label="清空已选牌"><text class="link-btn-text">清空</text></button>
      </view>
      <view class="actions">
        <template v-if="myTurn">
          <button class="btn hint" hover-class="btn-hover" @tap="doHint"><text class="btn-symbol">✦</text><text>提示</text></button>
          <button class="btn ghost" hover-class="btn-hover" :disabled="mustLead" :class="{ disabled: mustLead }" @tap="doPass"><text class="btn-symbol">→</text><text>不出</text></button>
          <button class="btn primary" hover-class="btn-hover" :disabled="!canPlay.allowed" :class="{ disabled: !canPlay.allowed }" @tap="doPlay"><text class="btn-symbol">▶</text><text>出牌</text></button>
        </template>
        <view v-else class="waiting-action"><view class="waiting-dot pulse"></view><text class="waiting-text">等待其他玩家行动</text></view>
      </view>
    </view>

    <SettleDialog
      v-if="showSettle"
      :mark-class="winnerTeam === 0 ? 'win' : ''"
      :mark-text="winnerTeam === 0 ? '胜' : '负'"
      kicker="掼蛋结算"
      :title="resultTitle"
      :subtitle="`出牌顺序：${finishText}`"
      :rows="settleRows"
      :chips="settleChips"
      :action-label="nextActionLabel"
      @action="$emit('next')"
    />
  </view>
</template>

<script>
/**
 * 掼蛋对局面板：2v2 牌桌、配牌提示、27 张横滑手牌、副/整局结算。
 * 引擎动作经事件上报给页面壳层执行；本组件只维护选牌/滑选本地状态。
 */
import { RANK_CHARS } from '../../game/cards.js'
import { analyzeGuandan, canBeatGuandan, GT as GD_T, TYPE_NAMES as GD_TYPE_NAMES } from '../../game/guandan/patterns.js'
import { GD_PHASE, GD_TEAMS } from '../../game/guandan/rules.js'
import { createDragController, cacheRectsFromDocument, cacheRectsFromUni } from '../../ui/drag-select.js'
import { rankChar, suitChar, cardLabel as baseCardLabel } from '../../ui/cards-display.js'
import { formatBeans } from '../../ui/profile.js'
import PlayingCard from '../PlayingCard.vue'
import SettleDialog from '../SettleDialog.vue'

const SEATS = [
  { id: 'me', name: '你', isAI: false, team: 0 },
  { id: 'ai-left', name: 'AI·左', isAI: true, team: 1 },
  { id: 'partner', name: 'AI·队友', isAI: true, team: 0 },
  { id: 'ai-right', name: 'AI·右', isAI: true, team: 1 },
]

export default {
  name: 'GuandanBoard',
  options: {
    // 小程序端：组件节点虚拟化（避免包裹层破坏 flex 布局）+ 页面样式穿透
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
  components: { PlayingCard, SettleDialog },
  emits: ['play', 'pass', 'hint', 'next'],
  props: {
    snap: { type: Object, required: true },
    aiTurnSeat: { type: Number, default: null },
    playAnimSeat: { type: Number, default: null },
    trickKey: { type: Number, default: 0 },
    finishRevealActive: { type: Boolean, default: false },
    finishRevealDone: { type: Boolean, default: false },
    beanBalance: { type: Number, default: 0 },
    beanDelta: { type: Number, default: 0 },
    hintResult: { type: Object, default: null },
  },

  data() {
    return {
      sideSeats: [2, 1, 3],
      selectedIds: [],
      hintedIds: [],
    }
  },

  computed: {
    myCards() {
      return (this.snap.players[0] && this.snap.players[0].cards) || []
    },
    // 已选牌的牌型判定 —— 校验/文案/按钮状态共用这一个 computed，保证彼此一致
    selectedPattern() {
      if (!this.selectedIds.length) return null
      const cards = this.myCards.filter((card) => this.selectedIds.includes(card.id))
      return analyzeGuandan(cards, this.snap.level)
    },
    myTurn() {
      return this.snap.phase === GD_PHASE.PLAY && this.snap.turnSeat === 0
    },
    mustLead() {
      return this.myTurn && (!this.snap.current || this.snap.current.seat === 0)
    },
    levelLabel() {
      return RANK_CHARS[this.snap.level] || String(this.snap.level || 15)
    },
    wildLabel() {
      return `红桃${this.levelLabel}配牌`
    },
    tributeText() {
      const tribute = this.snap.lastTribute
      if (!tribute) return ''
      if (tribute.skipped) return '本副抗贡 · 由上游领出'
      if (tribute.type === 'double') return '双贡已完成 · 贡牌较大者先领出'
      return '单贡已完成 · 末游先领出'
    },
    currentTypeName() {
      const pattern = this.snap.current && this.snap.current.pattern
      return this.patternLabel(pattern)
    },
    isBomb() {
      const pattern = this.snap.current && this.snap.current.pattern
      return !!pattern && [GD_T.BOMB, GD_T.ROCKET, GD_T.STRAIGHT_FLUSH].includes(pattern.type)
    },
    statusText() {
      if (this.finishRevealActive && this.snap.phase === GD_PHASE.OVER) return this.winnerTeam === 0 ? '我方出完，展示剩余手牌' : '对手出完，展示剩余手牌'
      if (this.snap.phase === GD_PHASE.OVER) return this.resultTitle
      const turn = this.snap.turnSeat
      return turn === 0 ? '轮到你出牌' : `等待 ${this.seatName(turn)} 出牌`
    },
    statusSubtitle() {
      if (this.finishRevealActive && this.snap.phase === GD_PHASE.OVER) return '先展示各座位剩余手牌，再进入结算'
      if (this.snap.phase === GD_PHASE.OVER) return `出牌顺序：${this.finishText}`
      return `当前 ${this.levelLabel} 级 · ${this.wildLabel}`
    },
    resultTitle() {
      const result = this.snap.roundResult
      if (!result) return '本轮结束'
      const winner = result.winnerTeam === 0 ? '我方' : '对手'
      if (result.matchWinnerTeam !== null && result.matchWinnerTeam !== undefined) return `${winner}打过 A · 赢得整局`
      if (result.outcome === 'double') return `${winner}双下 · ${winner}升级 3 级`
      if (result.outcome === 'single') return `${winner}单下 · ${winner}升级 2 级`
      return `${winner}胜利 · ${winner}升级 1 级`
    },
    nextActionLabel() {
      const result = this.snap.roundResult
      return result && result.matchWinnerTeam !== null && result.matchWinnerTeam !== undefined ? '重新开始' : '下一副'
    },
    winnerTeam() {
      const result = this.snap.roundResult
      return result ? result.winnerTeam : null
    },
    levelGain() {
      const result = this.snap.roundResult
      return result ? result.levelGain : 0
    },
    finishText() {
      const order = this.snap.finishOrder || []
      return order.length ? order.map((seat) => this.seatName(seat)).join(' → ') : '对局进行中'
    },
    showSettle() {
      return this.snap.phase === GD_PHASE.OVER && !!this.snap.settle && this.finishRevealDone
    },
    selectionText() {
      if (!this.myTurn) return this.snap.phase === GD_PHASE.OVER ? '本轮已结束' : '等待轮到你出牌'
      if (!this.selectedIds.length) return this.mustLead ? '请选择一手牌领出' : '选择要出的牌'
      const pattern = this.selectedPattern
      return pattern ? this.patternLabel(pattern) : '牌型未成型'
    },
    canPlay() {
      if (!this.myTurn) return { allowed: false, reason: '未轮到你' }
      if (!this.selectedIds.length) return { allowed: false, reason: '请先选择要出的牌' }
      const pattern = this.selectedPattern
      if (!pattern) return { allowed: false, reason: '牌型不成型，请调整选牌' }
      const previous = this.snap.current && this.snap.current.pattern
      if (!canBeatGuandan(previous, pattern)) return { allowed: false, reason: '牌型不匹配或压不过上家' }
      return { allowed: true, reason: '' }
    },
    feedbackKind() {
      if (!this.myTurn || !this.selectedIds.length) return 'info'
      if (!this.selectedPattern) return 'error'
      return this.canPlay.allowed ? 'ok' : 'warn'
    },
    feedbackText() {
      if (!this.myTurn) return this.snap.phase === GD_PHASE.OVER ? '本轮结算已完成' : '等待其他玩家行动'
      if (!this.selectedIds.length) return this.mustLead ? '新一轮请领出一手合法牌' : '选择牌型，或点击提示'
      const prefix = this.hintedIds.length ? '智能提示：' : ''
      return this.canPlay.allowed ? `${prefix}已选 ${this.selectionText} · 可以出牌` : this.canPlay.reason
    },
    settleRows() {
      return (this.snap.settle || []).map((row) => ({
        name: this.seatName(row.seat),
        role: row.team === 0 ? '我方' : '对手',
        highlight: row.team === 0,
        delta: row.delta,
      }))
    },
    settleChips() {
      return [`升级 ${this.levelGain} 级`, `欢乐豆 ${this.beanDelta >= 0 ? '+' : ''}${this.beanDelta}`]
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
        uni.showToast({ title: '当前牌权下建议不出', icon: 'none' })
        return
      }
      const pattern = this.selectedPattern
      if (pattern) uni.showToast({ title: `建议：${this.patternLabel(pattern)}`, icon: 'none' })
    },
  },

  created() {
    this.drag = createDragController({
      getCards: () => this.myCards,
      getSelection: () => this.selectedIds,
      setSelection: (ids) => {
        this.selectedIds = ids
      },
      clearHints: () => {
        this.hintedIds = []
      },
      isInteractive: () => this.myTurn,
      selector: '.gd-hand-card',
      cacheRects: (selector) => {
        if (typeof document !== 'undefined') return cacheRectsFromDocument(selector)
        return cacheRectsFromUni(selector)
      },
    })
  },

  mounted() {
    if (typeof document === 'undefined') return
    this.docHandlers = {
      down: (event) => this.handleDocDown(event),
      move: (event) => {
        if (this.drag.selecting) this.drag.move(event)
      },
      up: (event) => {
        if (this.drag.selecting) this.drag.end(event)
      },
    }
    document.addEventListener('mousedown', this.docHandlers.down)
    document.addEventListener('mousemove', this.docHandlers.move)
    document.addEventListener('mouseup', this.docHandlers.up)
  },

  beforeUnmount() {
    if (typeof document !== 'undefined' && this.docHandlers) {
      document.removeEventListener('mousedown', this.docHandlers.down)
      document.removeEventListener('mousemove', this.docHandlers.move)
      document.removeEventListener('mouseup', this.docHandlers.up)
      this.docHandlers = null
    }
    if (this.drag) this.drag.reset()
  },

  methods: {
    formatBeans,
    levelChar(level) {
      return RANK_CHARS[level] || String(level)
    },
    seatName(seat) {
      return (SEATS[seat] && SEATS[seat].name) || `座位${seat}`
    },
    avatarText(seat) {
      return seat === 2 ? '队' : seat === 1 ? '左' : '右'
    },
    teamOf(seat) {
      return GD_TEAMS[seat]
    },
    isActive(seat) {
      return this.snap.phase === GD_PHASE.PLAY && this.snap.turnSeat === seat
    },
    cardCount(seat) {
      return (this.snap.players[seat] && this.snap.players[seat].cardCount) || 0
    },
    lastAction(seat) {
      const history = this.snap.history || []
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].seat === seat) return history[i]
      }
      return null
    },
    remainingCards(seat) {
      const player = this.snap.players[seat]
      return player && Array.isArray(player.cards) ? player.cards : []
    },
    lastPlay(seat) {
      const history = this.snap.history || []
      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i]
        if (entry.seat === seat && !entry.pass && entry.cards && entry.cards.length) return entry
      }
      return null
    },
    patternLabel(pattern) {
      if (!pattern) return ''
      if (pattern.type === GD_T.ROCKET) return '四王'
      if (pattern.type === GD_T.BOMB) return pattern.bombSize >= 4 ? `${pattern.bombSize}炸` : '炸弹'
      return GD_TYPE_NAMES[pattern.type] || '出牌'
    },
    actionLabel(seat) {
      const action = this.lastAction(seat)
      if (!action) return ''
      if (action.pass) return '不出'
      return `${this.patternLabel(action.pattern)} ${action.cards.length} 张`
    },
    isWild(card) {
      return card.rank === this.snap.level && card.suit === 0
    },
    cardLabel(card) {
      return this.isWild(card) ? `红桃${this.levelLabel}配牌` : `${rankChar(card)}${suitChar(card)}`
    },

    onCardDragStart(event, index) {
      this.drag.start(event, index)
    },
    onCardDragMove(event) {
      this.drag.move(event)
    },
    onCardDragEnd(event) {
      this.drag.end(event)
    },
    onHandMouseUp(event) {
      this.drag.end(event)
    },
    handleDocDown(event) {
      if (!event || event.button !== 0 || !event.target) return
      const element = event.target.closest ? event.target : event.target.parentElement
      const card = element && element.closest ? element.closest('.gd-hand-card') : null
      if (!card) return
      const index = Number(card.dataset.cardIndex)
      if (Number.isInteger(index)) this.drag.start(event, index)
    },
    onCardTap(id) {
      if (this.drag.shouldIgnoreTap()) return
      if (!this.myTurn) {
        uni.showToast({ title: '未轮到你出牌', icon: 'none' })
        return
      }
      const index = this.selectedIds.indexOf(id)
      this.hintedIds = []
      if (index >= 0) this.selectedIds.splice(index, 1)
      else this.selectedIds.push(id)
    },
    clearSelection() {
      this.selectedIds = []
      this.hintedIds = []
    },
    doPlay() {
      if (!this.canPlay.allowed) {
        uni.showToast({ title: this.canPlay.reason, icon: 'none' })
        return
      }
      const cards = this.myCards.filter((card) => this.selectedIds.includes(card.id))
      this.$emit('play', cards)
    },
    doPass() {
      if (this.mustLead) {
        uni.showToast({ title: '新一轮必须出牌', icon: 'none' })
        return
      }
      this.$emit('pass')
    },
    doHint() {
      if (!this.myTurn) {
        uni.showToast({ title: '未轮到你出牌', icon: 'none' })
        return
      }
      this.$emit('hint', this.selectedIds.slice())
    },
  },
}
</script>
