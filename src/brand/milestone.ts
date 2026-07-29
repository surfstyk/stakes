// The "Banked the ___" milestone vocabulary. The whole reward loop is a money arc:
// you STAKE it (day 0) → keep your word → BANK it (the seal you earn for a flawless run,
// every single day kept). The badge is named after the natural time-unit you banked, so
// each length feels like its own milestone. Round units get a name; anything else falls
// back to "N days" (honest, and a gentle nudge toward the round milestones).
//
// Returns a lowercase unit phrase ("the week", "two weeks", "19 days"); call sites
// title-/upper-case it as the surface needs ("Banked the week." · "BANKED THE WEEK").
export function milestone(days: number): string {
  switch (days) {
    case 3:
      return 'the weekend'
    case 7:
      return 'the week'
    case 14:
      return 'two weeks'
    case 21:
      return 'three weeks'
    case 30:
      return 'the month'
    default:
      return `${days} days`
  }
}
