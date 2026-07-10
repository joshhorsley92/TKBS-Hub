#!/bin/bash
# Posts a Slack notification after every `git commit` made through Claude Code.
# Wired via the PostToolUse hook in .claude/settings.json. This is the portable
# TKBS commit notifier installed by the `workspaceinit` skill — it derives the
# repo name, GitHub URL, and commit author dynamically, so it works unchanged in
# any repo.
#
# Always exits 0 and never blocks a tool call. Silently does nothing when:
#   - the tool command was not a `git commit`
#   - node cannot be found
#   - no SLACK_WEBHOOK_URL is configured (repo stays inert until you add it)

set +e

# --- locate node (Windows git-bash path first, then PATH) ---
if [ -x "/c/Program Files/nodejs/node" ]; then
  NODE="/c/Program Files/nodejs/node"
else
  NODE="$(command -v node 2>/dev/null || true)"
fi
[ -z "$NODE" ] && exit 0

# --- repo root: Claude Code sets CLAUDE_PROJECT_DIR; fall back to git ---
REPO="${CLAUDE_PROJECT_DIR:-}"
[ -z "$REPO" ] && REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$REPO" ] && exit 0

# --- pull the tool's command string out of the hook stdin JSON ---
INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | "$NODE" -e '
  let d="";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try { process.stdout.write((JSON.parse(d).tool_input || {}).command || ""); }
    catch (e) { process.exit(0); }
  });
' 2>/dev/null || true)"

# Only fire on git commit commands
echo "$CMD" | grep -q "git commit" || exit 0

HASH="$(git -C "$REPO" log -1 --pretty=format:%h 2>/dev/null || true)"
SUBJ="$(git -C "$REPO" log -1 --pretty=format:%s 2>/dev/null || true)"
[ -z "$HASH" ] && exit 0

# --- resolve the webhook: injected env -> project local -> user-global ---
if [ -z "$SLACK_WEBHOOK_URL" ]; then
  SLACK_WEBHOOK_URL="$(REPO="$REPO" "$NODE" -e '
    const fs = require("fs");
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const paths = [
      process.env.REPO + "/.claude/settings.local.json",
      home + "/.claude/settings.local.json"
    ];
    for (const p of paths) {
      try {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        if (j.env && j.env.SLACK_WEBHOOK_URL) { process.stdout.write(j.env.SLACK_WEBHOOK_URL); break; }
      } catch (e) {}
    }
  ' 2>/dev/null || true)"
fi
[ -z "$SLACK_WEBHOOK_URL" ] && exit 0

# --- derive repo name + author, build the GitHub link, then POST ---
COMMIT_HASH="$HASH" COMMIT_SUBJ="$SUBJ" REPO="$REPO" SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL" "$NODE" -e '
  const https = require("https");
  const cp = require("child_process");
  const REPO = process.env.REPO;
  const sh = (c) => { try { return cp.execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { return ""; } };
  const h = process.env.COMMIT_HASH || "";
  const s = process.env.COMMIT_SUBJ || "";

  let origin = sh("git -C \"" + REPO + "\" remote get-url origin");
  origin = origin.replace(/^git@github\.com:/, "https://github.com/").replace(/^git@/, "https://").replace(/\.git$/, "");
  const isUrl = /^https?:\/\//.test(origin);
  const repoName = (isUrl ? origin.split("/").slice(-2).join("/") : "") || REPO.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "repo";
  const link = isUrl ? "\n" + origin + "/commit/" + h : "";
  const author = sh("git -C \"" + REPO + "\" config user.name") || "someone";

  const text = "📌 *" + repoName + " — new commit by " + author + "*\n`" + h + "` " + s + link;
  const body = JSON.stringify({ text });
  let u;
  try { u = new URL(process.env.SLACK_WEBHOOK_URL); } catch (e) { process.exit(0); }
  const req = https.request({
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  });
  req.on("error", () => {});
  req.write(body);
  req.end();
' 2>/dev/null

exit 0
