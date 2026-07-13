# Time tracking — setting up a machine

Every Claude Code chat window tracks itself: hours worked, tokens burned, which
client it was for. There is no command to run and nothing to remember. A hook
re-derives each session from the transcript Claude Code already writes.

Because it *re-derives* rather than *observes*, **work done before the hook
existed can be backfilled** — the transcripts are already on disk.

---

## The one thing to understand first

**Transcripts are local.** Joe's sessions live on Joe's laptop, Josh's on Josh's.
Neither machine can see the other's.

That is deliberate, not a limitation. The backfill run **on a machine** reads
**that machine's** identity and resolves to **that person**. Run from someone
else's laptop, it would resolve to *them*, and quietly put your hours on their
ledger. So each person runs it on their own machine. Once.

---

## Setup (per machine)

### 1. Clone the hub and install

```bash
git clone https://github.com/joshhorsley92/TKBS-Hub.git C:/TKBS-Hub
cd C:/TKBS-Hub
npm install
```

The path doesn't have to be `C:/TKBS-Hub`, but note wherever you put it — step 3
needs it.

### 2. Configure `.env.local`

Copy `.env.local.example` to `.env.local` and fill in the same Supabase keys and
`SYNC_SECRET` the other machine uses. **Everyone points at the same Supabase** —
that's what makes it one shared board.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SYNC_SECRET=...                       # must match the other machines
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEV_BYPASS_AUTH=1
DEV_USER=josh@tkbsmarketing.com       # your address
```

`NEXT_PUBLIC_APP_URL` stays `localhost` — **you run your own copy of the hub, and
it writes to the shared Supabase.** Nothing needs to be deployed, and you don't
need to reach anyone else's machine.

### 3. Check the hub knows who you are

```bash
git config --global user.email
```

This must match a row in the hub's **Connections → Identity mappings**
(`identities`, kind `git_email`). Currently mapped:

| git email | person |
|---|---|
| `joseph.zolinski57@gmail.com` | Joe Zolinski |
| `joshhorsley92@gmail.com` | Josh Horsley |

**Why `--global` and not plain `git config user.email`:** the plain version
returns the *repo-local* identity, which answers "who authors commits here" — a
different question. Joe and Josh share a GitHub account, and Joe's `Web-Hosting`
checkout is configured with Josh's address. Using it billed 53 hours of Joe's
work to Josh at $200/hr. The global identity belongs to the machine's *owner*,
which is the person at the keyboard.

If your global git email is ambiguous or missing, set an explicit override
instead — it always wins:

```
TKBS_USER=josh
```

### 4. Install the hook globally

This is what makes it fire in **every repo**, not just this one.

Edit `~/.claude/settings.json` (create it if absent) and add:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node \"C:/TKBS-Hub/.claude/hooks/track-time.mjs\"", "async": true }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node \"C:/TKBS-Hub/.claude/hooks/track-time.mjs\"", "async": true }] }
    ]
  }
}
```

Use the **absolute path** to wherever you cloned the hub. `$CLAUDE_PROJECT_DIR`
will not work — it points at whatever repo you happen to be in.

If the file already has a `hooks` block, merge into it rather than replacing it.

### 5. Backfill your history

Start the hub, then dry-run. **Nothing is written until you pass `--write`.**

```bash
npm run dev                                    # in one terminal
node scripts/backfill-time.mjs                 # in another — DRY RUN
```

It prints every project folder, how many sessions, hours, and imputed cost. Read
it. If it looks right:

```bash
node scripts/backfill-time.mjs --write --since 2026-06-01
```

Re-running is safe — it upserts on the Claude session id, so nothing duplicates.

Flags:

| flag | what it does |
|---|---|
| `--write` | actually send it (without this it's a dry run) |
| `--since 2026-06-01` | only sessions on or after this date |
| `--no-ai` | skip summaries and client suggestions — much faster |

Without `--no-ai` it makes two Haiku calls per session (a one-line label, and —
for repos that serve several clients — a guess at which client, offered for you
to confirm). Budget a few minutes for a month of history.

### 6. Done

Open `/time`. From now on every chat window in every repo records itself.

---

## What it does and doesn't know

**Who** — the machine's global git identity, mapped through `identities`. If it
can't resolve you, the session is stored with the person as **unknown** and the
board asks. It never guesses a name.

**For whom** — from the folder you were working in, via the hub's repo→client
map. A repo dedicated to one client (`Foundations-Tree-Experts`) answers it
outright. A repo that serves several (`TKBS-Creative-Pipeline`) can't, so Claude
reads the session's own prompts and *names* a client — as a **suggestion** with a
one-click confirm on the Time page. Nothing is booked to a client on a guess, and
a name that isn't on the real client list is discarded.

**How long** — the clock runs across the conversation, and any gap longer than 15
minutes is excluded. A long agentic run still counts in full, on purpose: the
hour is real, and so is what Claude burned during it. That needs no exception —
Claude emits continuously while it works, so a genuine hour-long run is hundreds
of consecutive short gaps, not one long one. A 15-minute silence only ever means
nobody was there: you walked away, or Claude was parked on a permission prompt.

**What it costs** — three figures, and two of them are real:

| | |
|---|---|
| **Labour** | hours × your rate. **Real cash.** |
| **Allocated** | the real $200/mo subscription, split across clients by token share. **Real cash.** |
| **Imputed** | those tokens at Anthropic list price. **Notional — this money was never spent.** Claude Code bills against a subscription, so a token's marginal cost is zero. It's the right number for pricing work; it is not a number you paid. |

Imputed and allocated are **never added together** — that would double-count.

---

## If the hub isn't running

The hook queues the session to `~/.claude/tkbs-time-queue.jsonl` and flushes it
on the next fire once the hub is reachable. Nothing is lost to a closed laptop or
a stopped dev server — but the hub does need to run *sometime* for the queue to
drain. Deploying it would remove that chore entirely.

---

## Known gaps

- **Subagent sessions** are filtered by a 120-second floor. Their wall-clock time
  sits inside the parent's, so counting it would double-count the hours — but it
  also drops their tokens, so token cost is slightly **under-reported** on
  sessions that fanned out to subagents. Under-reporting is the safe direction.
- **Only Claude work tracks itself.** Calls, meetings, bookkeeping and design
  generate no events. Log those by hand (`+ Log time` on the Time page) or the
  board will only ever see the engineering.
