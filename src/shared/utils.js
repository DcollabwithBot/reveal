// Shared utility functions

export function dk(h, a = 40) {
  const n = parseInt(h.replace("#", ""), 16);
  return `#${(Math.max(0, (n >> 16) - a) << 16 | Math.max(0, ((n >> 8) & 0xff) - a) << 8 | Math.max(0, (n & 0xff) - a)).toString(16).padStart(6, "0")}`;
}

export function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
