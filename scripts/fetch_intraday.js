#!/usr/bin/env node
/**
 * Intraday fetch entrypoint (GitHub Actions + local).
 */

import { spawnSync } from "node:child_process";

const p = spawnSync("python", ["scripts/update_intraday.py"], { stdio: "inherit" });
process.exit(p.status ?? 1);
