import fs from "node:fs/promises";
import path from "node:path";

const status = process.env.INPUT_STATUS || "unknown";
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const token = process.env.GITHUB_TOKEN;

if (!repository || !runId || !token) throw new Error("缺少 GitHub Actions 运行环境变量");

const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
const response = await fetch(`${apiUrl}/repos/${repository}/actions/runs?per_page=10`, {
  headers: {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "write-skills-run-recorder",
  },
});
if (!response.ok) throw new Error(`查询最近运行失败：${response.status} ${await response.text()}`);
const payload = await response.json();
const now = new Date().toISOString();
const runs = (payload.workflow_runs || []).map((run) => ({
  runId: String(run.id),
  runNumber: run.run_number,
  workflow: run.name,
  event: run.event,
  branch: run.head_branch,
  commit: run.head_sha,
  status: String(run.id) === String(runId) ? status : (run.conclusion || run.status),
  createdAt: run.created_at,
  updatedAt: run.updated_at,
  url: run.html_url,
}));

if (!runs.some((run) => run.runId === String(runId))) {
  runs.unshift({
    runId: String(runId),
    runNumber: Number(process.env.GITHUB_RUN_NUMBER || 0),
    workflow: process.env.GITHUB_WORKFLOW,
    event: process.env.GITHUB_EVENT_NAME,
    branch: process.env.GITHUB_REF_NAME,
    commit: process.env.GITHUB_SHA,
    status,
    createdAt: now,
    updatedAt: now,
    url: runUrl,
  });
}

const directory = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), "run-history");
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, "recent-runs.json"), `${JSON.stringify({ generatedAt: now, repository, runs: runs.slice(0, 10) }, null, 2)}\n`);
const rows = runs.slice(0, 10).map((run) => `| [${run.runId}](${run.url}) | ${run.workflow} | ${run.status} | ${run.branch || "-"} | ${String(run.commit || "").slice(0, 7)} | ${run.updatedAt || run.createdAt} |`);
const markdown = `# Recent GitHub Actions runs\n\nGenerated: ${now}\n\n| Run ID | Workflow | Status | Branch | Commit | Updated |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
await fs.writeFile(path.join(directory, "recent-runs.md"), markdown);

await fs.appendFile(process.env.GITHUB_OUTPUT, `run-id=${runId}\nrun-url=${runUrl}\nhistory-path=${directory}\n`);
await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `## Workflow Run\n\n- Run ID: [${runId}](${runUrl})\n- Status: **${status}**\n- Recent history: \`run-history/recent-runs.md\`\n`);
console.log(`Run ID ${runId} (${status}) recorded.`);
