// Voice — every user-facing string in one place.
//
// Centralized so the tone stays consistent, a rename/naming pass is a one-file
// change, and i18n (window.nimiqPay.language) can slot in later. Static strings are
// plain; anything with a runtime value is a function. Headlines that use the italic
// accent word are modeled as {lead, em, tail} and rendered <h1>{lead}<em>{em}</em>{tail}</h1>.
//
// NOT here (deliberately, for now): the challenge TEMPLATES, WINDOW_PRESETS, and
// check-in MOODS — those are structured product data, not chrome copy; they live in
// product/store.ts and product/ProgressScreen.tsx.

import type { Asset } from '../vault/types.ts'
import { brand } from './brand.ts'

export interface Headline {
  lead?: string
  em: string
  tail?: string
}

export const copy = {
  app: {
    wordmark: brand.name,
    recon: 'recon',
    test: '⚡ test',
  },

  // First-run welcome — the <60s first impression for an organic opener (deeplink
  // arrivals skip straight to join, so they never see this).
  welcome: {
    kicker: 'Put your money where your mouth is',
    headline: { lead: 'Stake on a goal. ', em: 'Keep your word.' } as Headline,
    sub: 'Put a little on the line, show up daily, and get it all back when you finish — kept honest by your friends, not a camera.',
    steps: [
      { emoji: '🤝', title: 'Pledge', text: 'Stake on a goal for the week.' },
      { emoji: '🔥', title: 'Show up', text: 'Check in daily — your crew’s watching.' },
      { emoji: '🏅', title: 'Get it back', text: 'Finish and reclaim your stake, plus a little NIM.' },
    ],
    cta: 'Start a challenge →',
    foot: 'A commitment game built on trust, not surveillance.',
  },

  create: {
    resumeGo: 'Resume →',
    kicker: 'New challenge',
    h1: { lead: 'What are you ', em: 'committing', tail: ' to?' } as Headline,
    sub: 'Stake a little on a goal. Do it daily. Your crew keeps you honest.',
    customLabel: 'Your goal',
    customPlaceholder: 'e.g. write 500 words',
    durationLabel: 'For how long?',
    daysUnit: 'days',
    stakeLabel: 'The stake',
    stakeNote: 'Staked in NIM. Gasless and instant, and you get it all back if you finish.',
    windowLabel: 'Doors close…',
    testWindowNote: '⚡ Test mode on — doors close ~2 min after you create.',
    nameLabel: 'Sign it as',
    namePlaceholder: 'your first name',
    cta: (stake: number, asset: Asset) => `Stake ${stake} ${asset} & pledge →`,
    ctaBusy: 'Placing your stake…',
    errFallback: 'Could not place your stake.',
  },

  pledged: {
    kicker: 'Your pledge is live',
    h1: { lead: 'Now go ', em: 'post it.' } as Headline,
    sub: 'The first friend who taps in starts your week. This card is the invite.',
    share: 'Share to your story',
    shareCopied: 'Link copied ✓',
    goChallenge: 'Go to the challenge →',
    preview: 'Preview what friends see',
  },

  join: {
    kickerDared: (creator: string) => `${creator} dared you in`,
    h1: { lead: 'Are you ', em: 'in?' } as Headline,
    whosInOne: (a: string) => `${a} is in`,
    whosInTwo: (a: string, b: string) => `${a} & ${b} are in`,
    whosInMany: (a: string, b: string, extra: number) => `${a}, ${b} +${extra} are in`,
    stakingLine: (n: number, stake: number, asset: Asset) =>
      `${n} ${n === 1 ? 'person' : 'people'} staking ${stake} ${asset}`,
    countdown: 'Doors close in',
    miniToPlay: 'to play',
    nameLabel: 'Join as',
    namePlaceholder: 'your first name',
    cta: (stake: number, asset: Asset) => `Stake ${stake} ${asset} & join`,
    ctaBusy: 'Locking it in…',
    foothint: 'You get it all back if you finish the week.',

    joinedKicker: "You're in",
    joinedH1: 'See you Monday.',
    joinedSub: (stake: number, asset: Asset, whosIn: string) =>
      `${stake} ${asset} locked. ${whosIn}. Now drag a friend in — the more people watching, the harder it is to quit.`,
    pullFriend: 'Pull in a friend',
    goChallenge: 'Go to the challenge →',

    closedH1: 'Doors closed on this one.',
    closedSub: (creator: string, emoji: string) =>
      `${creator}'s ${emoji} week already kicked off. But you don't have to miss out.`,
    closedCta: 'Start the same challenge',
    closedFoot: (whosIn: string) => `${whosIn} on the last one.`,

    notFoundH1: "This one's gone.",
    notFoundSub:
      "The link's expired or the challenge doesn't exist. Start your own — it takes 30 seconds.",
    notFoundCta: 'Start a challenge',
  },

  progress: {
    dayOf: (day: number, total: number) => `Day ${day} of ${total}`,
    checkinLabel: "Today's check-in",
    checkinPlaceholder: 'proof + a line… your crew sees this',
    checkinCta: (day: number) => `Check in for day ${day}`,
    checkinBusy: 'Posting your check-in…',
    doneTitle: 'You did the week.',
    doneSub: 'See how everyone landed.',
    crewLabel: 'The crew',
    feedEmpty: 'No check-ins yet. Be the first.',
    feedDay: (day: number) => `Day ${day}`,
    seeResults: 'See results →',
    finishResults: 'Finish & see results →',
    notFoundH1: 'Challenge not found.',
    notFoundCta: 'Start one',
  },

  results: {
    kicker: (emoji: string, goal: string) => `${emoji} ${goal} · the week's up`,
    h1Perfect: { lead: 'Perfect ', em: 'week.' } as Headline,
    h1Landed: { lead: 'How it ', em: 'landed.' } as Headline,
    daysMeta: (done: number, total: number) => `${done}/${total} days`,
    back: (asset: string) => `${asset} back`,
    burnedRow: '🔥 burned',
    finisherRow: '🎉 finisher bonus',
    perfectClubRow: '🏅 perfect-week club',
    perfectClubJoined: 'joined',
    finisherBonus: (amt: string) => `+${amt} NIM`,
    perfectBadgeTitle: 'perfect week',
    shareWin: 'Share the win',
    shareWrap: 'Share the wrap',
    crewLabel: 'The crew',
    you: 'You',
    burnedSummary: (amt: string, asset: Asset) => `🔥 ${amt} ${asset} burned`,
    burnedSub: (finishers: number) =>
      `Removed from circulation. ${finishers} in the perfect-week club.`,
    burnedTag: (amt: string) => `−${amt} burned`,
    runItBack: 'Run it back →',
    none: 'No results yet.',
    home: 'Home',
  },

  // Text that rides along with a shared link / image.
  share: {
    pledge: (emoji: string, goal: string, days: number, stake: number, asset: Asset) =>
      `${emoji} I'm ${goal} for ${days} days, ${stake} ${asset} on the line. Watch me 👀`,
    joined: (creator: string, emoji: string) =>
      `I just joined ${creator}'s ${emoji} challenge. You in?`,
    resultsWin: (emoji: string, goal: string) =>
      `Perfect week ✅ ${emoji} ${goal}. Run it back?`,
    resultsWrap: (emoji: string) => `Wrapped my ${emoji} week on ${brand.name}.`,
  },

  // On-card lettering (pledge ticket + results card). Shared by the live DOM cards
  // and the canvas share-image renderer.
  cards: {
    brand: brand.name,
    pledgeMeta: 'The Pledge',
    pledgeGoalLead: "I'm",
    pledgeGoalFallback: 'doing the thing',
    pledgeForDays: (days: number) => `for ${days} days.`,
    pledgeOnLine: 'on the line',
    pledgeStamp: 'PLEDGED',
    pledgeStampSub: 'WATCH ME',
    pledgeFoot: 'hold me to it 🤞',
  },
}
