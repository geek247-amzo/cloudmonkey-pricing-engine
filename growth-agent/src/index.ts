import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const apiUrl = process.env.CM_API_URL ?? "http://cloudmonkey-pricing-engine:3000";
const token = process.env.GROWTH_AGENT_WORKER_TOKEN;
const codexBin = process.env.CODEX_BIN ?? "codex";
const pollMs = Math.max(15, Number(process.env.GROWTH_AGENT_POLL_SECONDS ?? 60)) * 1000;

if (!token) throw new Error("GROWTH_AGENT_WORKER_TOKEN is required");

async function api(path: string, body: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Growth-Agent-Token": token! },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

function buildPrompt(job: any) {
  return `You are the CloudMonkey organic growth Codex worker for one customer website.

Work only within the approved website growth scope. Inspect the supplied website context and produce a proposal; do not publish or deploy unless the context explicitly contains an approved proposal and the requested action is to apply it.

Non-negotiable policy: ethical SEO only. Do not use spam, cloaking, fake reviews, impersonation, copied content, deceptive claims, manipulative links, unsafe advice, or fabricated credentials, awards, statistics, or guarantees. Do not expose secrets. Keep changes within the configured limits.

Return only JSON matching this shape:
{
  "message": "short response or customer question",
  "proposal": {"title":"...","summary":"...","diff": {"files":[],"changes":[]}} | null,
  "deploymentRequest": {"proposalId":"...","deploymentDomain":"temporary"} | null,
  "usageAvailable": true,
  "usage": {"provider":"openai","model":"...","inputTokens":0,"outputTokens":0,"totalTokens":0,"providerCostMicrousd":0}
}

Website context:
${JSON.stringify(job.site)}

Agent configuration:
${JSON.stringify(job.agent)}

Recent workspace:
${JSON.stringify(job.workspace)}

Run context:
${JSON.stringify(job.run)}
`;
}

async function runCodex(job: any) {
  const outputPath = `/tmp/cloudmonkey-growth-${job.run.id}.json`;
  const approvedProposal = job.workspace?.proposals?.some((proposal: any) => proposal.status === "approved");
  const sandbox = approvedProposal ? "workspace-write" : "read-only";
  const scratch = await fs.mkdtemp(path.join(tmpdir(), `cloudmonkey-growth-${job.run.id}-`));
  const scratchWorkdir = path.join(scratch, "site");
  await fs.mkdir(scratchWorkdir, { recursive: true });
  await fs.writeFile(path.join(scratchWorkdir, "site.json"), JSON.stringify(job.site ?? {}, null, 2));
  await fs.writeFile(path.join(scratchWorkdir, "workspace.json"), JSON.stringify(job.workspace ?? {}, null, 2));
  await execFileAsync("git", ["init"], { cwd: scratchWorkdir });
  await execFileAsync("git", ["config", "user.email", "growth-agent@cloudmonkey.local"], { cwd: scratchWorkdir });
  await execFileAsync("git", ["config", "user.name", "CloudMonkey Growth Agent"], { cwd: scratchWorkdir });
  await execFileAsync("git", ["add", "-A"], { cwd: scratchWorkdir });
  await execFileAsync("git", ["commit", "-m", "growth run baseline"], { cwd: scratchWorkdir });
  const args = ["exec", "--json", "--ephemeral", "--sandbox", sandbox, "-C", scratchWorkdir, "-o", outputPath, buildPrompt({ ...job, workspace: { ...job.workspace, scratchFiles: ["site.json", "workspace.json"] } })];
  try {
    await execFileAsync(codexBin, args, { timeout: 15 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });
    const raw = await fs.readFile(outputPath, "utf8").catch(() => "{}");
    await execFileAsync("git", ["add", "-A"], { cwd: scratchWorkdir });
    const [{ stdout: nameOutput }, { stdout: patch }] = await Promise.all([
      execFileAsync("git", ["diff", "--cached", "--name-only"], { cwd: scratchWorkdir }),
      execFileAsync("git", ["diff", "--cached", "--no-ext-diff", "--binary"], { cwd: scratchWorkdir, maxBuffer: 10 * 1024 * 1024 }),
    ]);
    const files = nameOutput.split("\n").map((value) => value.trim()).filter(Boolean);
    return { ...JSON.parse(raw), verifiedDiff: { files, patch: patch.slice(0, 10 * 1024 * 1024), changeCount: files.length } };
  } finally {
    await fs.rm(outputPath, { force: true }).catch(() => undefined);
    await fs.rm(scratch, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function processOne() {
  const job = await api("/api/internal/growth-agent/claim", {});
  if (!job.run) return;
  try {
    const result = await runCodex(job);
    await api("/api/internal/growth-agent/complete", {
      runId: job.run.id,
      message: result.message ?? "Codex completed a growth review.",
      proposal: result.proposal ?? null,
      deploymentRequest: result.deploymentRequest ?? null,
      usageAvailable: result.usageAvailable === true,
      usage: result.usage ?? { provider: "openai", model: "codex-cli", inputTokens: 0, outputTokens: 0, totalTokens: 0, providerCostMicrousd: 0 },
      verifiedDiff: result.verifiedDiff ?? { files: [], patch: "", changeCount: 0 },
      modelClaimedDiff: result.proposal?.diff ?? null,
      metadata: { executor: "codex-cli", codexVersion: process.env.CODEX_VERSION ?? null },
    });
  } catch (error: any) {
    await api("/api/internal/growth-agent/fail", { runId: job.run.id, error: error?.message ?? String(error), metadata: { executor: "codex-cli" } }).catch((reportError) => console.error("Could not report growth failure", reportError));
  }
}

console.log(`CloudMonkey growth worker started; polling every ${pollMs / 1000}s`);
await processOne().catch((error) => console.error("Growth worker poll failed", error));
setInterval(() => processOne().catch((error) => console.error("Growth worker poll failed", error)), pollMs);
