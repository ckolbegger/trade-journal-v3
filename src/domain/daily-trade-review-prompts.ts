// The Daily Trade Review definition's prompt wording. The seed writes it; the Action form reads a saved Action's answers by it.
export const DAILY_TRADE_REVIEW_PROMPTS = {
  action: 'Action',
  intent: 'Why are you taking this action?',
  conviction: 'Conviction now',
  considered: 'Anything you considered doing and decided against?',
  note: 'Note',
} as const;
