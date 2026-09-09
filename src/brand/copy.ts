// Voice — every user-facing string in one place.
//
// The TEXT lives in ./copy.en.json (the single flat file you read + edit — catalogued from the
// design session for the reshaped journey, frames 01–12; see its _meta block for the rules).
// This module is a thin typed loader over it: plain strings pass through; runtime values are
// filled by a tiny {placeholder} formatter (see ./format.ts). Money is always digits, thousands
// separated (nim()); the day never says "midnight"; the chain never names what's still ahead.

import { fmt } from './format.ts'
import en from './copy.en.json'

export interface Headline {
  lead?: string
  em: string
  tail?: string
}

// money is always digits, thousands separated (catalogue rule)
const nim = (n: number) => n.toLocaleString('en-US')

export const copy = {
  gate: {
    kicker: en.gate.kicker,
    h1: en.gate.h1 as Headline,
    sub: en.gate.sub,
    open: en.gate.open,
    reassure: en.gate.reassure,
    get: en.gate.get,
    foot: en.gate.foot,
    guarantee: en.gate.guarantee,
    scanSub: en.gate.scanSub,
    scanCap: en.gate.scanCap,
  },

  // The claim system (story.md §7) — canonical, so every surface draws the one wording.
  claim: {
    hook: en.claim.hook,
    payoff: en.claim.payoff,
    signature: en.claim.signature,
    name: en.claim.name,
  },

  // Text that rides along with a shared link (solo).
  share: {
    sealDay1: (emoji: string, goal: string) => fmt(en.share.sealDay1, { emoji, goal }),
    dayKept: (emoji: string, goal: string) => fmt(en.share.dayKept, { emoji, goal }),
    bankedWeek: (emoji: string, goal: string) => fmt(en.share.bankedWeek, { emoji, goal }),
    perfectWeek: (emoji: string, goal: string) => fmt(en.share.perfectWeek, { emoji, goal }),
  },

  // ── The reshape (Cycle II) — the solo-first journey.
  rs: {
    // the rolling-24h day clock (never "midnight")
    clock: {
      closesAt: (closeTime: string) => fmt(en.rs.clock.closesAt, { closeTime }),
      hoursLeft: (hoursLeft: number) => fmt(en.rs.clock.hoursLeft, { hoursLeft }),
      moment: (hoursLeft: number, closeTime: string) => fmt(en.rs.clock.moment, { hoursLeft, closeTime }),
    },
    // the growing chain + its meta (behind + today, capped)
    chain: {
      earlier: (n: number) => fmt(en.rs.chain.earlier, { n }),
      bankedDays: (n: number) => (n === 1 ? en.rs.chain.bankedDaysOne : fmt(en.rs.chain.bankedDays, { n })),
      safe: (amount: number) => fmt(en.rs.chain.safe, { amount: nim(amount) }),
      safeNote: (amount: number) => fmt(en.rs.chain.safeNote, { amount: nim(amount) }),
      inARow: (n: number) => fmt(en.rs.chain.inARow, { n }),
    },
    // the dot's one intro line (the tap-open bubble on taste/official); day/missed taps draw from
    // the deterministic pick engine (sphere-content.json), not the catalogue.
    dot: {
      intro: en.rs.dot.intro,
    },
    main: {
      kicker: en.rs.main.kicker,
      hLead: en.rs.main.hLead,
      hEm: en.rs.main.hEm,
      startedThisWeek: (n: number) => fmt(en.rs.main.startedThisWeek, { n: n.toLocaleString() }),
      pager: (n: number) => fmt(en.rs.main.pager, { n }),
      cta: en.rs.main.cta,
    },
    taste: {
      h: en.rs.taste.h,
      sub: en.rs.taste.sub,
      caption: en.rs.taste.caption,
      cta: en.rs.taste.cta,
    },
    official: {
      h: en.rs.official.h,
      sub: en.rs.official.sub,
      perDayLabel: en.rs.official.perDayLabel,
      perDayUnit: en.rs.official.perDayUnit,
      lengthLabel: en.rs.official.lengthLabel,
      daysUnit: en.rs.official.daysUnit,
      ticketTerms: (amount: number, perDay: number) => fmt(en.rs.official.ticketTerms, { amount: nim(amount), perDay: nim(perDay) }),
      backdateLead: en.rs.official.backdateLead,
      backdateBold: en.rs.official.backdateBold,
      needNim: (need: number) => fmt(en.rs.official.needNim, { need }),
      cta: en.rs.official.cta,
      busy: en.rs.official.busy,
      err: en.rs.official.err,
      errCancel: en.rs.official.errCancel,
      stamp: en.rs.official.stamp,
      contractNo: (no: string) => fmt(en.rs.official.contractNo, { no }),
    },
    day: {
      h: en.rs.day.h,
      sub: (closeTime: string, hoursLeft: number, tomorrow: boolean) =>
        fmt(en.rs.day.sub, { closeTime, hoursLeft, when: tomorrow ? 'tomorrow' : 'today' }),
      ridingLbl: en.rs.day.ridingLbl,
      ridingNote: en.rs.day.ridingNote,
      cta: en.rs.day.cta,
      sealing: en.rs.day.sealing,
      sealedH: en.rs.day.sealedH,
      sealedSub: (amount: number) => fmt(en.rs.day.sealedSub, { amount: nim(amount) }),
      ledgerToday: en.rs.day.ledgerToday,
      ledgerSafe: en.rs.day.ledgerSafe,
      ledgerDays: en.rs.day.ledgerDays,
      stamped: (day: number) => fmt(en.rs.day.stamped, { day }),
      showSomeone: en.rs.day.showSomeone,
      err: en.rs.day.err,
    },
    // the shareable postcard (07)
    share: {
      h: en.rs.share.h,
      cardTop: (n: number) => (n === 1 ? en.rs.share.cardTopOne : fmt(en.rs.share.cardTop, { n })),
      cardBottom: (amount: number) => fmt(en.rs.share.cardBottom, { amount: nim(amount) }),
      tagline: en.rs.share.tagline,
      proof: en.rs.share.proof,
      cta: en.rs.share.cta,
    },
    missed: {
      h: en.rs.missed.h,
      subOne: (amount: number, hoursLeft: number) => fmt(en.rs.missed.subOne, { amount: nim(amount), hoursLeft }),
      subMany: (n: number, amount: number, hoursLeft: number) => fmt(en.rs.missed.subMany, { n, amount: nim(amount), hoursLeft }),
      ridingNote: en.rs.missed.ridingNote,
      cta: en.rs.missed.cta,
    },
    banked: {
      kicker: en.rs.banked.kicker,
      hLead: en.rs.banked.hLead,
      moneyLbl: en.rs.banked.moneyLbl,
      gain: (n: number) => fmt(en.rs.banked.gain, { n: nim(n) }),
      rowStake: en.rs.banked.rowStake,
      rowBonus: en.rs.banked.rowBonus,
      goAgainWeek: en.rs.banked.goAgainWeek,
      shareWin: en.rs.banked.shareWin,
      kickerUp: en.rs.banked.kickerUp,
      hPartial: (n: number) => fmt(en.rs.banked.hPartial, { n }),
      partialMoneyNote: (n: number, perDay: number) => fmt(en.rs.banked.partialMoneyNote, { n, perDay: nim(perDay) }),
      partialCredit: (n: number) => fmt(en.rs.banked.partialCredit, { n }),
      closedOnChain: (no: string) => fmt(en.rs.banked.closedOnChain, { no }),
      seeRecord: en.rs.banked.seeRecord,
      goAgainGoal: (label: string) => fmt(en.rs.banked.goAgainGoal, { label }),
      hWipeout: en.rs.banked.hWipeout,
      wipeoutNote: en.rs.banked.wipeoutNote,
      wipeoutFwdLead: en.rs.banked.wipeoutFwdLead,
      wipeoutFwdBold: en.rs.banked.wipeoutFwdBold,
      wipeoutFwdTail: en.rs.banked.wipeoutFwdTail,
      backHome: en.rs.banked.backHome,
      tryAgain: en.rs.banked.tryAgain,
    },
    reup: {
      kicker: en.rs.reup.kicker,
      hLead: en.rs.reup.hLead,
      hEm: en.rs.reup.hEm,
      sub: en.rs.reup.sub,
      recordNum: (n: number) => fmt(en.rs.reup.recordNum, { n }),
      pickNew: en.rs.reup.pickNew,
      anotherWeek: (label: string) => fmt(en.rs.reup.anotherWeek, { label }),
    },
    // the no-run home — "Your record." (design 11)
    record: {
      h: en.rs.record.h,
      sub: en.rs.record.sub,
      keptTotal: (n: number) => fmt(en.rs.record.keptTotal, { n }),
      cta: en.rs.record.cta,
    },
    archive: {
      meta: (kept: number, total: number, stake: number, when: string) => fmt(en.rs.archive.meta, { kept, total, stake, when }),
      metaLapsed: en.rs.archive.metaLapsed,
      tagBanked: en.rs.archive.tagBanked,
      tagPartial: en.rs.archive.tagPartial,
      tagLapsed: en.rs.archive.tagLapsed,
      tagGone: en.rs.archive.tagGone,
      thisWeek: en.rs.archive.thisWeek,
      lastWeek: en.rs.archive.lastWeek,
    },
    lapsed: {
      hLead: en.rs.lapsed.hLead,
      sub: en.rs.lapsed.sub,
      cta: en.rs.lapsed.cta,
    },
    shareCard: {
      stampRecord: en.rs.shareCard.stampRecord,
      no: (no: string) => fmt(en.rs.shareCard.no, { no }),
    },
    proof: {
      pre: en.rs.proof.pre,
      brand: en.rs.proof.brand,
      post: en.rs.proof.post,
    },
    chip: {
      dayOfN: (n: number, total: number) => fmt(en.rs.chip.dayOfN, { n, total }),
    },
  },

  // Accessibility labels (screen-reader only).
  a11y: {
    home: en.a11y.home,
    openSphere: en.a11y.openSphere,
    changeChallenge: en.a11y.changeChallenge,
    close: en.a11y.close,
  },
}
