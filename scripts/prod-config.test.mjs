import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildProductionConfig, parseJsonc } from "./prod-config.mjs";

const base = parseJsonc(readFileSync(new URL("../apps/api/wrangler.jsonc", import.meta.url), "utf8"));
const ID = "11111111-2222-3333-4444-555555555555";

test("parses the real wrangler.jsonc, comments and all", () => {
  assert.equal(base.name, "interview-tower");
  assert.equal(base.d1_databases[0].binding, "DB");
});

test("keeps // inside strings", () => {
  assert.equal(parseJsonc('{"u":"https://x.example/a" // trailing\n}').u, "https://x.example/a");
});

test("puts the real database id, assets and production vars in", () => {
  const c = buildProductionConfig(base, { D1_DATABASE_ID: ID, SITE_URL: "https://tower.example" });
  assert.equal(c.d1_databases[0].database_id, ID);
  assert.deepEqual(c.assets.run_worker_first, ["/api/*"]);
  assert.equal(c.vars.ENVIRONMENT, "production");
  assert.equal(c.vars.SITE_URL, "https://tower.example");
  assert.equal(c.routes, undefined);
});

test("a custom domain becomes a route and the site url", () => {
  const c = buildProductionConfig(base, { D1_DATABASE_ID: ID, CUSTOM_DOMAIN: "tower.example" });
  assert.deepEqual(c.routes, [{ pattern: "tower.example", custom_domain: true }]);
  assert.equal(c.vars.SITE_URL, "https://tower.example");
});

test("refuses to build without a database id, without a site, or over http", () => {
  assert.throws(() => buildProductionConfig(base, { SITE_URL: "https://x.example" }), /D1_DATABASE_ID/);
  assert.throws(() => buildProductionConfig(base, { D1_DATABASE_ID: ID }), /SITE_URL or CUSTOM_DOMAIN/);
  assert.throws(() => buildProductionConfig(base, { D1_DATABASE_ID: ID, SITE_URL: "http://x.example" }), /https/);
});

test("does not mutate the base config", () => {
  buildProductionConfig(base, { D1_DATABASE_ID: ID, SITE_URL: "https://x.example" });
  assert.equal(base.d1_databases[0].database_id, "00000000-0000-0000-0000-000000000000");
  assert.equal(base.assets, undefined);
});
