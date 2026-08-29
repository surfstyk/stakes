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

  // "Open in Nimiq Pay" gate — shown when a real-money build is opened OUTSIDE Nimiq Pay
  // (e.g. an invite link tapped in a normal browser). Routes the user into Nimiq Pay so
  // their real wallet + real stake are in play, instead of silently mock-staking.
  gate: {
    kicker: 'One quick step',
    h1: { lead: 'Open in ', em: 'Nimiq Pay' } as Headline,
    sub: 'Stakes runs inside Nimiq Pay — tap to open it and you’re in.',
    invitedKicker: (creator: string) => `${creator} dared you in`,
    invitedSub: 'Open it in Nimiq Pay to lock in your spot.',
    // shown when an invite link (?c=…) points at a challenge that's over / gone — so the
    // invitee learns it here instead of crossing into Nimiq Pay only to hit a dead end.
    expiredKicker: 'That invite’s gone',
    expiredH1: { lead: 'This one ', em: 'expired.' } as Headline,
    expiredSub: 'The challenge is over or the link’s dead — but you can start your own in seconds.',
    expiredOpen: 'Start your own in Nimiq Pay →',
    open: 'Open in Nimiq Pay →',
    reassure: 'First time? Nimiq Pay may ask you to confirm — that’s normal.',
    get: "Don't have it? Get Nimiq Pay",
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
    stakeNote: 'Staked in NIM — no fees. Keep every day and it all comes back, plus a NIM bonus.',
    windowLabel: 'Doors close…',
    testWindowNote: '⚡ Test mode on — doors close ~2 min after you create.',
    nameLabel: 'Sign it as',
    namePlaceholder: 'your first name',
    cta: (stake: number, asset: Asset) => `Stake ${stake} ${asset} & pledge →`,
    ctaBusy: 'Placing your stake…',
    errFallback: 'Could not place your stake.',
    // Shown when the CTA is tapped before a required field is filled — we scroll to the
    // field instead of leaving a dead, greyed-out button.
    needGoal: 'Add your goal first ↑',
    needName: 'Add your name to sign the pledge.',
  },

  pledged: {
    kicker: 'Your pledge is live',
    h1: { lead: 'Now go ', em: 'show', tail: ' them.' } as Headline,
    sub: 'The first friend who taps in starts your run.',
    share: 'Share to your story',
    inviteLead: 'Rather just send the link?',
    invite: 'Copy invite',
    inviteCopied: 'Copied ✓',
    goChallenge: 'Go to the challenge →',
    preview: 'Preview what friends see',
    // shown if a share link is opened for a pledge that no longer exists
    notFoundH1: 'This pledge is gone.',
    notFoundSub: "It expired or was never finished. Start a fresh one — it takes 30 seconds.",
    notFoundCta: 'Start a new pledge',
  },

  join: {
    kickerDared: (creator: string) => `${creator} dared you in`,
    h1Lead: "Money's on the line.",
    h1: { lead: 'Are ', em: 'you', tail: ' in?' } as Headline,
    sub: 'Match the stake to join the run. Keep every day, get it all back.',
    whosInOne: (a: string) => `${a} is in`,
    whosInTwo: (a: string, b: string) => `${a} & ${b} are in`,
    whosInMany: (a: string, b: string, extra: number) => `${a}, ${b} +${extra} are in`,
    crewRunning: "the crew's already running",
    countdown: 'Doors close in',
    nameLabel: 'Join as',
    namePlaceholder: 'your first name',
    needName: 'Add your name to join the run.',
    cta: (stake: number, asset: Asset) => `Put ${stake} ${asset} in — I'm in`,
    ctaBusy: 'Locking it in…',
    errCancel: "You didn't confirm the stake — tap to try again.",
    errFallback: 'Could not lock in your stake. Check your connection and try again.',
    guarantee: 'Free to move · held safe · back in your pocket',
    offerExit: 'Not ready? Start your own instead',
    heldSafe: (stake: number, asset: Asset) =>
      `Your ${stake} ${asset} is held safe until your run's up. Keep every day and it all comes back, plus a NIM bonus.`,

    joinedKicker: "You're locked in",
    joinedH1: { lead: "You're ", em: 'in', tail: '.' } as Headline,
    joinedSub: (stake: number, asset: Asset) =>
      `${stake} ${asset} on the line — and the crew's watching now.`,
    youMake: (n: number) => `You make ${n}`,
    reshareQuote: 'The more people watching, the harder it is to quit.',
    pullFriend: 'Pull in a friend',
    pullFriendCopied: 'Link copied ✓ — send it over',
    later: 'Maybe later — take me to my challenge',

    closedH1: 'Doors closed on this one.',
    closedSub: (creator: string, emoji: string) =>
      `${creator}'s ${emoji} run already kicked off. But you don't have to miss out.`,
    closedCta: 'Start the same challenge',
    closedFoot: (whosIn: string) => `${whosIn} on the last one.`,

    notFoundH1: "This one's gone.",
    notFoundSub:
      "The link's expired or the challenge doesn't exist. Start your own — it takes 30 seconds.",
    notFoundCta: 'Start a challenge',
  },

  progress: {
    dayOf: (day: number, total: number) => `Day ${day} of ${total}`,
    startsKicker: 'Doors still closing',
    startsTitle: 'Your challenge starts soon',
    startsSub: (t: string) => `First check-in opens when the doors close — in ${t}.`,
    wrappedKicker: 'The challenge wrapped',
    windowLeft: (t: string) => `${t} left to check in today`,
    checkedTitle: 'Checked in for today ✓',
    checkedSub: (t: string) => `Next check-in opens in ${t}.`,
    overTitle: "Time's up.",
    overSub: 'See how everyone landed.',
    checkinLabel: "Today's check-in",
    checkinPlaceholder: 'proof + a line… your crew sees this',
    checkinCta: (day: number) => `Check in for day ${day}`,
    checkinBusy: 'Posting your check-in…',
    errFallback: 'Could not post your check-in. Try again.',
    doneTitle: 'You did the week.',
    doneSub: 'See how everyone landed.',
    crewLabel: 'The crew',
    feedEmpty: 'No check-ins yet. Be the first.',
    feedDay: (day: number) => `Day ${day}`,
    seeResults: 'See results →',
    shareLabel: 'Show your streak',
    shareCta: 'Share my progress',
    notFoundH1: 'Challenge not found.',
    notFoundCta: 'Start one',
  },

  results: {
    kicker: (emoji: string, goal: string) => `${emoji} ${goal} · the run's up`,
    // "Banked <unit>." — the seal for a flawless run (every day kept). Unit-aware, so a
    // 7-day run reads "Banked the week." and a 30-day one "Banked the month." See milestone().
    h1Perfect: (unit: string) => ({ lead: 'Banked ', em: `${unit}.` }) as Headline,
    h1Landed: { lead: 'How it ', em: 'landed.' } as Headline,
    daysMeta: (done: number, total: number) => `${done}/${total} days`,
    back: (asset: string) => `${asset} back`,
    banked: (asset: string) => `${asset} banked`, // perfect finishers: stake + bonus = banked
    // Personal payout hero — the "what you got" moment (stake back + the NIM finisher bonus).
    yoursKicker: 'Yours',
    backPart: (amt: string, asset: string) => `${amt} ${asset} back`,
    bonusPart: (amt: string, asset: string) => `+${amt} ${asset} bonus`,
    lostPart: (amt: string, asset: string) => `−${amt} ${asset} lost`,
    landed: 'Landed in your wallet',
    settling: 'Settling — lands in about a minute',
    perfectBadgeTitle: 'banked in full',
    shareWin: 'Share the win',
    shareWrap: 'Share the wrap',
    crewLabel: 'The crew',
    you: 'You',
    burnedSummary: (amt: string, asset: Asset) => `${amt} ${asset} gone for good`,
    burnedSub: (finishers: number) =>
      `Missed days aren't pocketed by anyone. ${finishers} banked it in full.`,
    burnedTag: (amt: string) => `−${amt} lost`,
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
    resultsWin: (emoji: string, goal: string, unit: string) =>
      `Banked ${unit} ✅ ${emoji} ${goal}. Run it back?`,
    resultsWrap: (emoji: string) => `Wrapped my ${emoji} run on ${brand.name}.`,
    progress: (emoji: string, goal: string, day: number, total: number) =>
      `Day ${day}/${total} of ${goal} ${emoji} — still in. Watch me 👀`,
  },

  // ── The reshape (Cycle II) — the solo-first journey. DRAFT copy, ported from the
  // finished artboards (surfstyk-notes/brand/onboarding-v2/). Accent headlines are kept
  // as separate {lead, em, tail} words so a locale can place the emphasis (§1.5).
  rs: {
    main: {
      kicker: 'Pick your one thing',
      hLead: 'What do you keep ',
      hEm: 'putting off',
      startedThisWeek: (n: number) => `${n.toLocaleString()} started this week`,
      cta: 'Start day one',
    },
    taste: {
      hTop: 'That took nerve.',
      hLead: 'Now ',
      hEm: 'live',
      hTail: ' the day',
      hintPre: 'Here for the tricky moments. ',
      hintEm: 'Tap me any time.',
      hintPost: ' I keep no score.',
      exit: 'Not this one',
      cta: 'Make it count',
    },
    official: {
      hLead: 'Now put it ',
      hEm: 'on the line',
      sub: 'Back your word with a little NIM. Keep every day and it all comes back, plus a completion bonus.',
      perDayLabel: 'A little a day',
      perDayUnit: 'NIM / day',
      lengthLabel: 'For how long',
      daysUnit: 'days',
      backdateLead: 'Runs from this morning — ',
      backdateBold: 'day one is already yours.',
      needNim: (need: number) => `You need about ${need} NIM in your wallet to make this official.`,
      cta: 'Make it official.',
      busy: 'Confirming your stake…',
      err: 'That didn’t go through. Tap to try again.',
    },
    seal: {
      kicker: 'Day one, sealed',
      hLead: 'On the record',
      cardTop: 'Day one.',
      cardBottom: 'On the record.',
      cta: 'Share day one',
    },
    day: {
      streakPill: (n: number) => `${n}-day streak`,
      cta: 'I did it today',
      sealing: 'Sealing the day…',
      sealedKicker: (day: number) => `Day ${day}, sealed`,
      onchain: 'On the record',
      toGo: (n: number) => (n === 1 ? 'Come back tomorrow · 1 to go' : `Come back tomorrow · ${n} to go`),
      lastSealed: 'Every day kept. Banking now…',
      shareDay: (day: number) => `Share day ${day}`,
      err: 'Could not seal today. Try again.',
    },
    banked: {
      // win
      kicker: 'Banked',
      hLead: 'You kept your word',
      moneyLbl: 'Back in your wallet',
      gain: (n: number) => `${n} more than you staked`,
      rowStake: 'Your stake, returned',
      rowBonus: 'Completion bonus',
      rowBanked: 'Banked',
      goAgainWeek: 'Go again — another week',
      shareWin: 'Share the win',
      // partial + wipeout
      kickerUp: 'The run’s up',
      hPartialLead: 'You kept ',
      hPartialTail: ' days.',
      partialNote: (kept: number, total: number) => `You kept ${kept} of ${total}. The other ${total - kept} slices burned.`,
      rowKept: (n: number) => `Kept · ${n} days`,
      rowBurned: (n: number) => `Burned · ${n} days`,
      rowBack: 'Back',
      partialFwdLead: 'Every day you kept ',
      partialFwdBold: 'still stands',
      partialFwdTail: ' on your record. Go again — clean this time.',
      seeRecord: 'See your record',
      goAgainGoal: (label: string) => `Go again — ${label}`,
      hWipeout: 'This one got away.',
      burnedLbl: 'Burned',
      wipeoutNote: 'No days kept, so nothing came back this time.',
      wipeoutFwdLead: 'It happens. ',
      wipeoutFwdBold: 'The next one’s yours',
      wipeoutFwdTail: ' — start fresh whenever you’re ready.',
      backHome: 'Back to home',
      tryAgain: 'Try again',
    },
    reup: {
      kicker: 'The habit is forming',
      hLead: 'Don’t stop ',
      hEm: 'now',
      sub: 'You’ve strung together more than most people ever do. Keep the chain alive.',
      recordNum: (n: number) => `${n} days kept`,
      pickNew: 'Pick a new goal',
      anotherWeek: (label: string) => `Another week — ${label}`,
    },
    archive: {
      h: 'Your challenges',
      lead: 'Everything you’ve run. Tap one to run it again.',
      meta: (kept: number, total: number, stake: number, when: string) => `Kept ${kept}/${total} · ${stake} NIM · ${when}`,
      metaLapsed: 'Ran out in 24h · never staked',
      tagBanked: 'Banked',
      tagPartial: 'Partial',
      tagLapsed: 'Lapsed',
      tagGone: 'Got away',
      start: 'Start a challenge',
    },
    missed: {
      hLead: 'Missed one. It happens',
      sub: (slice: number, kept: number) =>
        `Yesterday’s slice burned — ${slice} NIM. Your streak starts over. ${kept > 0 ? 'Every day you kept still stands.' : 'What you do next is what counts.'}`,
      hintPre: 'One miss isn’t the story. ',
      hintEm: 'Today is.',
      hintPost: ' Tap me if it’s a hard one.',
      cta: 'Win today',
    },
    lapsed: {
      hLead: 'That one slipped by',
      sub: 'Day one’s window closed before it became a real challenge. No harm done — start a fresh one whenever you’re ready.',
      cta: 'Start day one, again',
    },
    perfectweek: {
      kicker: 'Perfect week',
      hLead: 'Seven for ',
      hEm: 'seven',
      sub: 'A clean week — the thing most people never string together. This is how a habit is born.',
      cta: 'Share the week',
    },
    sphere: {
      // the taste-day hint + the tap → pick (the curated line library)
      tasteHint: { pre: 'Here for the tricky moments. ', em: 'Tap me any time.', post: ' I keep no score.' },
      pickCtx: (label: string, day: number) => `For your ${label} week · day ${day}`,
      pickShare: 'Share this',
    },
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
    // DOM pledge ticket (PledgeTicket.tsx)
    ticketSignedBy: 'Signed by',
    ticketSealed: 'Sealed',
    ticketCta: { lead: 'Doors are open — ', em: 'tap in', tail: ' 👀' } as Headline,
    lockedIn: '· Locked in ·',
  },
}
