import assert from "node:assert/strict";
import test from "node:test";
import { parseBoolean } from "../apps/api/src/parse-boolean.js";

test("parseBoolean handles boolean, string, array, and fallback cases correctly", () => {
  assert.equal(parseBoolean(false, true), false);
  assert.equal(parseBoolean("false", true), false);
  assert.equal(parseBoolean(["false"], true), false);
  assert.equal(parseBoolean(["true", "false"], true), false);
  assert.equal(parseBoolean("0", true), false);
  assert.equal(parseBoolean("off", true), false);
  assert.equal(parseBoolean("khong", true), false);
  assert.equal(parseBoolean("không", true), false);

  assert.equal(parseBoolean(true, false), true);
  assert.equal(parseBoolean("true", false), true);
  assert.equal(parseBoolean(["true"], false), true);
  assert.equal(parseBoolean("1", false), true);
  assert.equal(parseBoolean("yes", false), true);
  assert.equal(parseBoolean("co", false), true);
  assert.equal(parseBoolean("có", false), true);
});
