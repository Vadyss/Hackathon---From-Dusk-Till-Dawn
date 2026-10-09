import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");
test("API proxy removes /api prefix and preserves the static frontend", () => {
  assert.match(config, /location \/api\/\s*\{[^}]*proxy_pass http:\/\/backend:8000\/;/);
  assert.match(config, /location \/\s*\{[^}]*try_files/);
});
test("WebSocket proxy forwards upgrades and permits three minutes idle", () => {
  const block = config.match(/location = \/api\/ws\s*\{([^}]*)\}/)?.[1];
  assert.ok(block);
  assert.match(block, /proxy_pass http:\/\/backend:8000\/ws;/);
  assert.match(block, /proxy_http_version 1\.1;/);
  assert.match(block, /proxy_set_header Upgrade \$http_upgrade;/);
  assert.match(block, /proxy_set_header Connection "upgrade";/);
  const seconds = Number(block.match(/proxy_read_timeout (\d+)s;/)?.[1]);
  assert.ok(seconds >= 180);
});
