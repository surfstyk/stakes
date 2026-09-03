// Voice — every user-facing string in one place.
//
// The TEXT lives in ./copy.en.json (the single flat file you read + edit). This module is
// a thin typed loader over it: plain strings pass through; runtime values are filled by a
// tiny {placeholder} formatter (see ./format.ts); accent headlines stay {lead, em, tail}.
// Components import `copy` and its shape is unchanged — editing a word is a JSON-only change,
// and a locale (messages/de.json …) is a later drop-in reading window.nimiqPay.language.

import { fmt } from './format.ts'
import en from './copy.en.json'

export interface Headline {
  lead?: string
  em: string
  tail?: string
}

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
  },

  // ── The reshape (Cycle II) — the solo-first journey. Accent headlines keep
  // {lead, em, tail} as separate words so a locale can place the emphasis (§1.5).
  rs: {
    main: {
      kicker: en.rs.main.kicker,
      hLead: en.rs.main.hLead,
      hEm: en.rs.main.hEm,
      startedThisWeek: (n: number) => fmt(en.rs.main.startedThisWeek, { n: n.toLocaleString() }),
      cta: en.rs.main.cta,
    },
    taste: {
      hTop: en.rs.taste.hTop,
      hLead: en.rs.taste.hLead,
      hEm: en.rs.taste.hEm,
      hTail: en.rs.taste.hTail,
      hintPre: en.rs.taste.hintPre,
      hintEm: en.rs.taste.hintEm,
      hintPost: en.rs.taste.hintPost,
      exit: en.rs.taste.exit,
      cta: en.rs.taste.cta,
    },
    official: {
      hLead: en.rs.official.hLead,
      hEm: en.rs.official.hEm,
      sub: en.rs.official.sub,
      hintPre: en.rs.official.hintPre,
      hintEm: en.rs.official.hintEm,
      hintPost: en.rs.official.hintPost,
      perDayLabel: en.rs.official.perDayLabel,
      perDayUnit: en.rs.official.perDayUnit,
      lengthLabel: en.rs.official.lengthLabel,
      daysUnit: en.rs.official.daysUnit,
      backdateLead: en.rs.official.backdateLead,
      backdateBold: en.rs.official.backdateBold,
      needNim: (need: number) => fmt(en.rs.official.needNim, { need }),
      cta: en.rs.official.cta,
      busy: en.rs.official.busy,
      err: en.rs.official.err,
      errCancel: en.rs.official.errCancel,
      stamp: en.rs.official.stamp,
      contractWeek: en.rs.official.contractWeek,
      contractDaysN: (days: number) => fmt(en.rs.official.contractDaysN, { days }),
      contractNo: (no: string) => fmt(en.rs.official.contractNo, { no }),
    },
    seal: {
      kicker: en.rs.seal.kicker,
      hLead: en.rs.seal.hLead,
      cardTop: en.rs.seal.cardTop,
      cardBottom: en.rs.seal.cardBottom,
      cta: en.rs.seal.cta,
    },
    day: {
      streakPill: (n: number) => fmt(en.rs.day.streakPill, { n }),
      cta: en.rs.day.cta,
      sealing: en.rs.day.sealing,
      sealedKicker: (day: number) => fmt(en.rs.day.sealedKicker, { day }),
      onchain: en.rs.day.onchain,
      toGo: (n: number) => fmt(en.rs.day.toGo, { n }),
      lastSealed: en.rs.day.lastSealed,
      shareDay: (day: number) => fmt(en.rs.day.shareDay, { day }),
      err: en.rs.day.err,
    },
    banked: {
      kicker: en.rs.banked.kicker,
      hLead: en.rs.banked.hLead,
      moneyLbl: en.rs.banked.moneyLbl,
      gain: (n: number) => fmt(en.rs.banked.gain, { n }),
      rowStake: en.rs.banked.rowStake,
      rowBonus: en.rs.banked.rowBonus,
      rowBanked: en.rs.banked.rowBanked,
      goAgainWeek: en.rs.banked.goAgainWeek,
      shareWin: en.rs.banked.shareWin,
      kickerUp: en.rs.banked.kickerUp,
      hPartialLead: en.rs.banked.hPartialLead,
      hPartialTail: en.rs.banked.hPartialTail,
      partialNote: (kept: number, total: number) => fmt(en.rs.banked.partialNote, { kept, total, other: total - kept }),
      rowKept: (n: number) => fmt(en.rs.banked.rowKept, { n }),
      rowBurned: (n: number) => fmt(en.rs.banked.rowBurned, { n }),
      rowBack: en.rs.banked.rowBack,
      partialFwdLead: en.rs.banked.partialFwdLead,
      partialFwdBold: en.rs.banked.partialFwdBold,
      partialFwdTail: en.rs.banked.partialFwdTail,
      seeRecord: en.rs.banked.seeRecord,
      goAgainGoal: (label: string) => fmt(en.rs.banked.goAgainGoal, { label }),
      hWipeout: en.rs.banked.hWipeout,
      burnedLbl: en.rs.banked.burnedLbl,
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
    archive: {
      h: en.rs.archive.h,
      lead: en.rs.archive.lead,
      meta: (kept: number, total: number, stake: number, when: string) => fmt(en.rs.archive.meta, { kept, total, stake, when }),
      metaLapsed: en.rs.archive.metaLapsed,
      tagBanked: en.rs.archive.tagBanked,
      tagPartial: en.rs.archive.tagPartial,
      tagLapsed: en.rs.archive.tagLapsed,
      tagGone: en.rs.archive.tagGone,
      start: en.rs.archive.start,
      thisWeek: en.rs.archive.thisWeek,
      lastWeek: en.rs.archive.lastWeek,
    },
    missed: {
      hLead: en.rs.missed.hLead,
      sub: (slice: number, kept: number) => fmt(en.rs.missed.sub, { slice, tail: kept > 0 ? en.rs.missed.subKeptYes : en.rs.missed.subKeptNo }),
      hintPre: en.rs.missed.hintPre,
      hintEm: en.rs.missed.hintEm,
      hintPost: en.rs.missed.hintPost,
      cta: en.rs.missed.cta,
    },
    lapsed: {
      hLead: en.rs.lapsed.hLead,
      sub: en.rs.lapsed.sub,
      cta: en.rs.lapsed.cta,
    },
    perfectweek: {
      kicker: en.rs.perfectweek.kicker,
      hLead: en.rs.perfectweek.hLead,
      hEm: en.rs.perfectweek.hEm,
      sub: en.rs.perfectweek.sub,
      cta: en.rs.perfectweek.cta,
    },
    sphere: {
      tasteHint: { pre: en.rs.sphere.tasteHint.pre, em: en.rs.sphere.tasteHint.em, post: en.rs.sphere.tasteHint.post },
      pickCtx: (label: string, day: number) => fmt(en.rs.sphere.pickCtx, { label, day }),
      pickShare: en.rs.sphere.pickShare,
    },
    shareCard: {
      stampRecord: en.rs.shareCard.stampRecord,
      cta: en.rs.shareCard.cta,
      no: (no: string) => fmt(en.rs.shareCard.no, { no }),
    },
    proof: {
      pre: en.rs.proof.pre,
      brand: en.rs.proof.brand,
      post: en.rs.proof.post,
    },
  },

  // Accessibility labels (screen-reader only).
  a11y: {
    home: en.a11y.home,
    openSphere: en.a11y.openSphere,
    close: en.a11y.close,
  },
}
