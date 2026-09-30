import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type EntreeJournal = { tag: string; when: number; idx: number };

function verifierJournal(entries: EntreeJournal[]) {
  assert.ok(entries.length >= 2);
  const tags = new Set<string>();
  const idxs = new Set<number>();
  for (let index = 0; index < entries.length; index += 1) {
    const courant = entries[index];
    assert.equal(idxs.has(courant.idx), false, `idx ${courant.idx} en double (${courant.tag})`);
    idxs.add(courant.idx);
    assert.equal(courant.idx, index, `idx ${courant.idx} non consécutif, attendu ${index} (${courant.tag})`);
    assert.equal(tags.has(courant.tag), false, `tag ${courant.tag} en double`);
    tags.add(courant.tag);
    if (index === 0) continue;
    const precedent = entries[index - 1];
    assert.ok(
      typeof courant.when === "number" && courant.when > precedent.when,
      `${courant.tag} (${courant.when}) doit être postérieur à ${precedent.tag} (${precedent.when})`,
    );
  }
  return tags;
}

describe("journal Drizzle", () => {
  it("ordonne les migrations par un idx consécutif et un when strictement croissant", () => {
    const journal = JSON.parse(
      readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
    ) as { entries: EntreeJournal[] };
    const tags = verifierJournal(journal.entries);
    assert.equal(tags.has("0003_limite_tentative"), true);
    assert.equal(tags.has("0004_audit_referentiel"), true);
    const audit = journal.entries.find((entree) => entree.tag === "0004_audit_referentiel");
    assert.equal(audit?.idx, 4);
    assert.equal(audit?.when, 1790800000000);
  });

  it("échoue si un idx est en double", () => {
    assert.throws(() =>
      verifierJournal([
        { tag: "0000_a", when: 1, idx: 0 },
        { tag: "0001_b", when: 2, idx: 0 },
      ]),
    );
  });

  it("échoue si les idx ne sont pas consécutifs", () => {
    assert.throws(() =>
      verifierJournal([
        { tag: "0000_a", when: 1, idx: 0 },
        { tag: "0002_b", when: 2, idx: 2 },
      ]),
    );
  });

  it("échoue si les when ne sont pas strictement croissants", () => {
    assert.throws(() =>
      verifierJournal([
        { tag: "0000_a", when: 2, idx: 0 },
        { tag: "0001_b", when: 2, idx: 1 },
      ]),
    );
    assert.throws(() =>
      verifierJournal([
        { tag: "0000_a", when: 3, idx: 0 },
        { tag: "0001_b", when: 2, idx: 1 },
      ]),
    );
  });
});
