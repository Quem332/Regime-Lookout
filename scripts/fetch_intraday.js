#!/usr/bin/env node
/**
 * Intraday fetch entrypoint (GitHub Actions + local).
 *
 * Tries python3 first (Ubuntu runners), falls back to python (Windows).
 */
import { spawnSync } from "node:child_process";

function run(cmd) {
  const p = spawnSync(cmd, ["scripts/update_intraday.py"], { stdio: "inherit" });
  return p.status ?? 1;
}

let code = run("python3");
if (code !== 0) code = run("python");
process.exit(code);
