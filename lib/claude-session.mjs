// Parse a Claude Code session transcript into worked time + token cost.
//
// Plain .mjs with zero dependencies ON PURPOSE: this runs inside a Claude Code
// hook on someone's laptop, outside the Next.js build, possibly before
// `npm install` has ever run in that repo. It must work from a bare node.
//
// ── The clock ──────────────────────────────────────────────────────────────
// The transcript is an append-only JSONL of every user input and assistant
// output, each timestamped. Worked time is the total span between consecutive
// events, EXCLUDING any gap longer than 15 minutes — that's nobody at the desk.
//
// A long agentic run counts IN FULL, which is deliberate: the hour is real, and
// so is what Claude burned during it. That falls out for free rather than needing
// a special case, because Claude emits continuously while it works — a run only
// looks like a long gap if it wasn't running. See the rule for why the tempting
// refinement ("only idle if Claude spoke last") is wrong in both directions.
//
// ── The cost ───────────────────────────────────────────────────────────────
// Token totals come from each assistant message's `usage` block. Cache writes
// are split by TTL because they're priced differently (5-minute writes are
// 1.25× base input, 1-hour writes 2×). Cache READS dominate the volume in any
// long session and are cheap per token — but there are a very great many of
// them, so they can't be ignored.

import { readFileSync } from 'node:fs';

export const IDLE_GAP_SECONDS = 15 * 60;

/** $ per million tokens. Mirrors public.model_pricing — the DB is the source of
 *  truth; this is the fallback when the hook can't reach the hub. */
export const FALLBACK_PRICING = {
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, write5m: 6.25, write1h: 10 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5, write5m: 6.25, write1h: 10 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, write5m: 3.75, write1h: 6 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, write5m: 1.25, write1h: 2 },
};

export function parseTranscript(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }

  const events = [];
  const tokens = { input: 0, output: 0, cacheRead: 0, write5m: 0, write1h: 0 };
  const models = new Set();
  const prompts = [];
  // The transcript records the working directory it ran in. That makes a
  // session self-describing: it can be attributed long after the fact, without
  // the hook having been present at the time. It's what makes backfill possible.
  let cwd = null;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // a half-written trailing line while the session is live
    }

    if (!cwd && o.cwd) cwd = o.cwd;

    const kind = o.type;
    if ((kind === 'user' || kind === 'assistant') && o.timestamp) {
      const at = Date.parse(o.timestamp);
      if (Number.isFinite(at)) events.push({ at });
    }

    // Keep the human's asks (not Claude's replies) for the summary prompt.
    // Tool results arrive as type:'user' too, and so do injected reminders —
    // neither is a thing a human said, and feeding them to the summariser makes
    // it describe the machinery instead of the work.
    if (kind === 'user' && !o.isMeta) {
      const c = o.message?.content;
      let text = null;
      if (typeof c === 'string') text = c;
      else if (Array.isArray(c) && !c.some((b) => b?.type === 'tool_result')) {
        text = c.find((b) => b?.type === 'text')?.text ?? null;
      }
      if (text) prompts.push(text.slice(0, 400));
    }

    const usage = o.message?.usage;
    if (usage) {
      if (o.message.model) models.add(o.message.model);
      tokens.input += usage.input_tokens ?? 0;
      tokens.output += usage.output_tokens ?? 0;
      tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
      const cc = usage.cache_creation ?? {};
      tokens.write5m += cc.ephemeral_5m_input_tokens ?? 0;
      tokens.write1h += cc.ephemeral_1h_input_tokens ?? 0;
      // Older transcripts have only the flat total; attribute it to the 5m
      // bucket rather than dropping it (under-prices slightly; never over-prices).
      if (!cc.ephemeral_5m_input_tokens && !cc.ephemeral_1h_input_tokens) {
        tokens.write5m += usage.cache_creation_input_tokens ?? 0;
      }
    }
  }

  if (!events.length) return null;
  events.sort((a, b) => a.at - b.at);

  let worked = 0;
  let idle = 0;
  for (let i = 0; i < events.length - 1; i++) {
    const gap = (events[i + 1].at - events[i].at) / 1000;
    // A gap longer than 15 minutes is idle. That's the whole rule — it does not
    // matter what sits on either side of it.
    //
    // The obvious-looking refinement, "only count it as idle if Claude spoke
    // last, because a long input→output gap is Claude working", is wrong twice
    // over, and both ways cost real money:
    //
    //   * It MISSES the human walking away. Claude's last act is often a tool
    //     call or an interrupted turn, and a tool_result is type:'user' — so the
    //     left-hand event isn't 'assistant' and the clock keeps running. One
    //     session sat across a weekend and banked a single 65.4-hour gap.
    //   * It PROTECTS gaps that are just a human not answering. Every long
    //     tool round-trip in this repo's history is a blocked prompt, not work:
    //     65.0h waiting on an AskUserQuestion, 16.8h on a Bash permission
    //     dialog, 2.7h on a Read. Real tool calls finish in seconds.
    //
    // And a long agentic run still counts IN FULL, which is the requirement —
    // not by special-casing it, but because it never contains a 15-minute gap in
    // the first place. Claude emits continuously; an uninterrupted three-hour run
    // is hundreds of consecutive sub-minute gaps, every one of them worked. The
    // only thing a 15-minute silence can mean is that nothing happened.
    if (gap > IDLE_GAP_SECONDS) idle += gap;
    else worked += gap;
  }

  return {
    cwd,
    startedAt: new Date(events[0].at).toISOString(),
    endedAt: new Date(events[events.length - 1].at).toISOString(),
    workedSeconds: Math.round(worked),
    idleSeconds: Math.round(idle),
    // Sessions do switch models mid-flight; price by the one that did the work.
    model: [...models].pop() ?? null,
    tokens,
    prompts,
    turns: events.length,
  };
}

/** Price a token bundle at API list. NOTIONAL — Claude Code bills against a
 *  subscription, so this money was never actually spent. */
export function imputedCost(tokens, model, pricing = FALLBACK_PRICING) {
  const p = pricing[model];
  if (!p) return null; // unknown model → unknown cost, not zero
  return (
    (tokens.input * p.input +
      tokens.output * p.output +
      tokens.cacheRead * p.cacheRead +
      tokens.write5m * p.write5m +
      tokens.write1h * p.write1h) /
    1e6
  );
}
