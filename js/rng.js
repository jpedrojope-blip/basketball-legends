// rng.js — gerador de números pseudoaleatórios com seed (determinístico).
// Mesmo seed = mesma carreira, sempre. Funciona em navegador e em Node (pra teste).

function hashSeed(str) {
  str = String(str);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seedStr) {
    this.seedStr = seedStr == null ? String(Date.now()) + Math.random() : String(seedStr);
    const seedGen = hashSeed(this.seedStr);
    this.next = mulberry32(seedGen());
  }
  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    // inclusive min..max
    return Math.floor(this.float(min, max + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  gaussian(mean = 0, stdev = 1) {
    // Box-Muller
    let u = 1 - this.next();
    let v = this.next();
    let z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdev + mean;
  }
}

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.RNG = factory();
})(typeof self !== "undefined" ? self : this, function () {
  return RNG;
});
