import assert from "node:assert/strict";
import test from "node:test";

import { pickLottery, validLottery } from "../src/lib/selected-lottery.ts";

test("só aceita modalidades que existem", () => {
  assert.equal(validLottery("mega-sena"), "mega-sena");
  assert.equal(validLottery("dupla-sena"), "dupla-sena");
  for (const invalid of ["", undefined, null, "loteca", "constructor", "__proto__", "toString", "../x"]) assert.equal(validLottery(invalid), undefined);
});

test("a URL vale mais que o cookie, e um valor inválido cai para o outro", () => {
  assert.equal(pickLottery("quina", "lotofacil"), "quina");
  assert.equal(pickLottery(undefined, "lotomania"), "lotomania");
  assert.equal(pickLottery("nao-existe", "dia-de-sorte"), "dia-de-sorte");
  assert.equal(pickLottery("nao-existe", "tambem-nao"), undefined);
  assert.equal(pickLottery(undefined, undefined), undefined);
});
