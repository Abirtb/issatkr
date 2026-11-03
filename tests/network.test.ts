import assert from "node:assert/strict";
import test from "node:test";
import { ipAllowed, normalizeNetwork } from "../src/lib/network";

test("fac networks: address, CIDR range, prefix, IPv6", () => {
  const networks = ["196.203.10.5", "192.168.0.0/16", "10.20.", "2001:db8::/32"];
  assert.equal(ipAllowed("196.203.10.5", networks), true);
  assert.equal(ipAllowed("196.203.10.6", networks), false);
  assert.equal(ipAllowed("192.168.44.7", networks), true);
  assert.equal(ipAllowed("192.169.0.1", networks), false);
  assert.equal(ipAllowed("10.20.3.4", networks), true);
  assert.equal(ipAllowed("10.200.3.4", networks), false);
  assert.equal(ipAllowed("::ffff:192.168.1.1", networks), true);
  assert.equal(ipAllowed("2001:db8:1::5", networks), true);
  assert.equal(ipAllowed("2001:db9::5", networks), false);
  assert.equal(ipAllowed("unknown", networks), false);
  assert.equal(ipAllowed("unknown", []), true);
});

test("fac networks: entries are checked and cleaned", () => {
  assert.equal(normalizeNetwork(" 10.20.* "), "10.20.");
  assert.equal(normalizeNetwork("192.168.1.0/24"), "192.168.1.0/24");
  assert.equal(normalizeNetwork("192.168.1.0/33"), null);
  assert.equal(normalizeNetwork("300.1.1.1"), null);
  assert.equal(normalizeNetwork("wifi-fac"), null);
});
