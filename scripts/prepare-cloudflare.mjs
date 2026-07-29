import { execFileSync } from "node:child_process";
import fs from "node:fs";

const databaseName = process.env.D1_DATABASE_NAME || "write-skills-db";
const configPath = "wrangler.jsonc";

function runWrangler(args, { showOutput = false } = {}) {
  const output = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", ...args],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      env: process.env,
    },
  );

  const normalized = output.trim();
  if (showOutput && normalized) console.log(normalized);
  return normalized;
}

function parseJsonOutput(output) {
  const starts = [output.indexOf("["), output.indexOf("{")]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  for (const start of starts) {
    try {
      return JSON.parse(output.slice(start));
    } catch {
      // Wrangler may print a notice before the JSON payload.
    }
  }

  throw new Error(`Wrangler 未返回可解析的 JSON：${output.slice(0, 300)}`);
}

function findDatabaseId(value) {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (
        item &&
        typeof item === "object" &&
        (item.name === databaseName || item.database_name === databaseName)
      ) {
        return item.uuid || item.id || item.database_id || null;
      }
    }

    for (const item of value) {
      const found = findDatabaseId(item);
      if (found) return found;
    }

    return null;
  }

  if (
    (value.name === databaseName || value.database_name === databaseName) &&
    (value.uuid || value.id || value.database_id)
  ) {
    return value.uuid || value.id || value.database_id;
  }

  for (const child of Object.values(value)) {
    const found = findDatabaseId(child);
    if (found) return found;
  }

  return null;
}

function listDatabaseId() {
  const databases = parseJsonOutput(runWrangler(["d1", "list", "--json"]));
  return findDatabaseId(databases);
}

async function waitForDatabaseId(maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const databaseId = listDatabaseId();
    if (databaseId) return databaseId;

    if (attempt < maxAttempts) {
      const delayMs = attempt * 1000;
      console.log(`D1 尚未出现在列表中，${delayMs / 1000} 秒后重试（${attempt}/${maxAttempts}）…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

console.log(`检查 Cloudflare D1 数据库：${databaseName}`);
let databaseId = listDatabaseId();

if (!databaseId) {
  console.log("数据库不存在，正在创建（位置提示：APAC）…");

  // Wrangler 4.x 的 `d1 create` 不支持 `--json`。
  // 创建完成后重新通过 `d1 list --json` 获取稳定的 database_id。
  runWrangler(
    ["d1", "create", databaseName, "--location", "apac"],
    { showOutput: true },
  );

  databaseId = await waitForDatabaseId();
}

if (!databaseId || typeof databaseId !== "string") {
  throw new Error(`已尝试创建 ${databaseName}，但无法从 Wrangler 获取 D1 database_id`);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const binding = config.d1_databases?.find((item) => item.binding === "DB");

if (!binding) throw new Error("wrangler.jsonc 中缺少 DB 绑定");

binding.database_name = databaseName;
binding.database_id = databaseId;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `database-id=${databaseId}\n`);
}

console.log(`D1 已就绪：${databaseName} (${databaseId})`);
