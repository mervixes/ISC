# Marked — ISC practice, marked like the boards

Sit a paper against the clock, photograph your answers, and have them marked the way a CISCE
examiner marks them. Every lost mark is explained and recorded, and a tutor holds your whole
record: papers, marks, mistakes, formulae you get wrong, and your calendar.

## What is inside

| Page | What it does |
| --- | --- |
| Dashboard | Three chapters to study right now (Done swaps in the next), countdown, predicted marks, calendar |
| Papers | Every paper you have sat, with its timer and its report |
| Analysis | One page per subject: history, weakest chapters, where marks go, open mistakes |
| Mistakes | Every mistake, the question that exposed it, why you made it, how to stop |
| Practice | The specimen questions you uploaded, filtered to your weak chapters |
| Types | Every chapter's question types, ranked by weightage, each one practisable |
| Vault | Formulae, derivations, reactions, mechanisms and tests, with traps |
| Tutor | Chat that reads your record, sees photos, draws graphs, edits your calendar and notes |
| Library | Your specimen papers, marking schemes and syllabi |
| API keys | Keys from any provider, tried in order with failover |

## Running locally

```bash
npm install
# .env must contain DATABASE_URL pointing at a PostgreSQL database
npm run dev
```

The schema creates itself on first start. `npx drizzle-kit push` also works.

## Deploying

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full walkthrough: Supabase setup, which of the
three connection strings to use and why, Vercel configuration, and a troubleshooting table.

The two things that break most deployments: `DATABASE_URL` must be set in Vercel before the first
deploy, and Fluid Compute must be enabled so functions can run for 300 seconds.

## Accuracy

The marking rules, chapter weightages, question types and vault content were built from the
CISCE ISC 2027 syllabus documents and the 2027 specimen papers with answer keys. It is a strict
estimate from an AI model, not an official result.
