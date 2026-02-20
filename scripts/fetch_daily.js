#!/usr/bin/env node
/**
 * Daily fetch entrypoint (GitHub Actions + local).
 *
 * We run the Python implementation to avoid re-implementing the feature
 * computation in JS.
 */

import { spawnSync } from "node:child_process";

const p = spawnSync("python", ["scripts/update_daily.py"], { stdio: "inherit" });
process.exit(p.status ?? 1);
