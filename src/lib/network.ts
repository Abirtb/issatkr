// Fac networks allowed for the teachers' roll call. An entry is an address
// ("196.203.10.5"), a CIDR range ("192.168.0.0/16", "2001:db8::/32") or a
// prefix ("10.20." / "10.20.*").

export function normalizeIp(ip: string) {
  const value = ip.trim().toLowerCase().replace(/%.*$/, "");
  // IPv4 seen through an IPv6 socket.
  return value.startsWith("::ffff:") && value.includes(".") ? value.slice(7) : value;
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((total, part) => total * 256 + Number(part), 0);
}

function ipv6ToBigInt(ip: string) {
  if (!ip.includes(":") || ip.split("::").length > 2) return null;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (!ip.includes("::") && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.reduce((total, group) => (total << BigInt(16)) + BigInt(parseInt(group, 16)), BigInt(0));
}

// A valid entry, cleaned up; null if it is not an address, range or prefix.
export function normalizeNetwork(entry: string) {
  const value = normalizeIp(entry).replace(/\*$/, "");
  if (!value) return null;
  const [address, bits, extra] = value.split("/");
  if (extra !== undefined) return null;
  if (bits !== undefined) {
    const size = Number(bits);
    if (!/^\d{1,3}$/.test(bits)) return null;
    if (ipv4ToNumber(address) !== null && size <= 32) return `${address}/${size}`;
    if (ipv6ToBigInt(address) !== null && size <= 128) return `${address}/${size}`;
    return null;
  }
  if (ipv4ToNumber(address) !== null || ipv6ToBigInt(address) !== null) return address;
  // Prefix: "10.20." or "2001:db8:".
  if (/^(\d{1,3}\.){1,3}$/.test(address) || /^([0-9a-f]{1,4}:)+$/.test(address)) return address;
  return null;
}

export function ipAllowed(ip: string, networks: string[]) {
  if (!networks.length) return true;
  const address = normalizeIp(ip);
  const v4 = ipv4ToNumber(address);
  const v6 = v4 === null ? ipv6ToBigInt(address) : null;
  if (v4 === null && v6 === null) return false;
  return networks.some((network) => {
    const [base, bits] = network.split("/");
    if (bits === undefined) return base.endsWith(".") || base.endsWith(":") ? address.startsWith(base) : address === base;
    const size = Number(bits);
    const baseV4 = ipv4ToNumber(base);
    if (v4 !== null && baseV4 !== null) {
      const block = 2 ** (32 - size);
      return Math.floor(v4 / block) === Math.floor(baseV4 / block);
    }
    const baseV6 = ipv6ToBigInt(base);
    if (v6 !== null && baseV6 !== null) {
      const shift = BigInt(128 - size);
      return v6 >> shift === baseV6 >> shift;
    }
    return false;
  });
}
