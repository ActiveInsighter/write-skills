import { execFileSync } from "node:child_process";
import fs from "node:fs";

const databaseName = process.env.D1_DATABASE_NAME || "write-skills-db";
const configPath = "wrangler.jsonc";

function runWrangler(args) {
  const output = execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env,
  });
  return output.trim();
}

function parseJsonOutput(output) {
  const starts = [output.indexOf("["), output.indexOf("{")].filter((index) => index >= 0).sort((a, b) => a - b);
  for (const start of starts) {
    try { return JSON.parse(output.slice(start)); } catch { /* try next candidate */ }
  }
  throw new Error(`Wrangler 未返回可解析的 JSON：${output.slice(0, 300)}`);
}

function findDatabaseId(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && (item.name === databaseName || item.database_name === databaseName)) {
        return item.uuid || item.id || item.database_id || null;
      }
    }
    for (const item of value) {
      const found = findDatabaseId(item);
      if (found) return found;
    }
    return null;
  }
  if ((value.name === databaseName || value.database_name === databaseName) && (value.uuid || value.id || value.database_id)) {
    return value.uuid || value.id || value.database_id;
  }
  for (const child of Object.values(value)) {
    const found = findDatabaseId(child);
    if (found) return found;
  }
  return null;
}

console.log(`检查 Cloudflare D1 数据库：${databaseName}`);
const list = parseJsonOutput(runWrangler(["d1", "list", "--json"]));
let databaseId = findDatabaseId(list);

if (!databaseId) {
  console.log("数据库不存在，正在创建（位置提示：APAC）…");
  const created = parseJsonOutput(runWrangler(["d1", "create", databaseName, "--location", "apac", "--json"]));
  databaseId = findDatabaseId(created);
}

if (!databaseId || typeof databaseId !== "string") throw new Error("无法确定 D1 database_id");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const binding = config.d1_databases?.find((item) => item.binding === "DB");
if (!binding) throw new Error("wrangler.jsonc 中缺少 DB 绑定");
binding.database_name = databaseName;
binding.database_id = databaseId;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `database-id=${databaseId}\n`);
console.log(`D1 已就绪：${databaseName} (${databaseId})`);
