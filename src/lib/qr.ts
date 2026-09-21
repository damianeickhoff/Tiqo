/**
 * A QR code, as a square of true and false.
 *
 * Written out rather than installed. The app needs exactly one thing of a QR
 * library — "turn this URL into a grid" — and a dependency for it would be a
 * package to keep up to date, a licence to carry and a build to grow for code
 * that is a page long and has not changed since 2006. The trade would be the
 * other way round for a barcode *reader*.
 *
 * Byte mode, error correction M, versions 1 to 6. M is the level printed labels
 * want: a fifth of the code can be scuffed and it still reads, which is the
 * whole point of putting one on a rack door. Six is where version information
 * blocks start, and 106 bytes is longer than any address this app produces — so
 * the ceiling costs nothing and the code stops before its most fiddly part.
 */

/** Data codewords, error-correction codewords per block, and blocks, by
 *  version, at level M. */
const VERSIONS = [
  { data: 16, ec: 10, blocks: 1 },
  { data: 28, ec: 16, blocks: 1 },
  { data: 44, ec: 26, blocks: 1 },
  { data: 64, ec: 18, blocks: 2 },
  { data: 86, ec: 24, blocks: 2 },
  { data: 108, ec: 16, blocks: 4 },
];

/** Where the alignment patterns sit, by version. Version 1 has none. */
const ALIGNMENT = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

/** The most a version can carry in byte mode: its data codewords, less the two
 *  the mode indicator and the length take. */
const capacity = (version: number) => VERSIONS[version - 1]!.data - 2;

export type QrMatrix = { size: number; modules: boolean[][] };

/**
 * The grid for a piece of text, or null when it is too long for version 6.
 *
 * Null rather than a throw: a label that cannot draw a code should print the
 * address instead, which is a worse label but not a broken page.
 */
export function qrMatrix(text: string): QrMatrix | null {
  const bytes = [...new TextEncoder().encode(text)];
  const version = VERSIONS.findIndex((_, index) => bytes.length <= capacity(index + 1)) + 1;
  if (version === 0) return null;

  const spec = VERSIONS[version - 1]!;
  const size = 17 + version * 4;

  // Mode (0100 for bytes), length, the bytes themselves, then the terminator
  // and the two pad codewords repeating until the block is full.
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let at = width - 1; at >= 0; at -= 1) bits.push((value >> at) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, spec.data * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let at = 0; at < bits.length; at += 8) {
    data.push(bits.slice(at, at + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0; data.length < spec.data; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  // Split into blocks, give each its own error correction, then interleave —
  // which is what makes a scuff across the label damage a little of every block
  // rather than all of one.
  const short = Math.floor(spec.data / spec.blocks);
  const longer = spec.data % spec.blocks;
  const blocks: { data: number[]; ec: number[] }[] = [];
  let taken = 0;
  for (let block = 0; block < spec.blocks; block += 1) {
    const length = short + (block >= spec.blocks - longer ? 1 : 0);
    const slice = data.slice(taken, taken + length);
    taken += length;
    blocks.push({ data: slice, ec: reedSolomon(slice, spec.ec) });
  }

  const codewords: number[] = [];
  for (let at = 0; at < short + 1; at += 1) {
    for (const block of blocks) if (at < block.data.length) codewords.push(block.data[at]!);
  }
  for (let at = 0; at < spec.ec; at += 1) {
    for (const block of blocks) codewords.push(block.ec[at]!);
  }

  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  // Which cells are the scanner's rather than the message's. Kept beside the
  // grid rather than worked out again afterwards: "is this a function pattern"
  // is the one question the mask has to get exactly right, and answering it
  // twice is how the two answers come to differ.
  const reserved = drawFunctionPatterns(modules, version, size);

  // The data snakes up and down the two-module columns from the bottom right,
  // stepping over everything already placed.
  const stream: number[] = [];
  for (const codeword of codewords)
    for (let at = 7; at >= 0; at -= 1) stream.push((codeword >> at) & 1);

  let cursor = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // The vertical timing line is not a data column.
    for (let step = 0; step < size; step += 1) {
      for (const column of [right, right - 1]) {
        const up = ((size - 1 - right) & 2) === 0;
        const row = up ? size - 1 - step : step;
        if (modules[row]![column] !== null) continue;
        modules[row]![column] = (stream[cursor] ?? 0) === 1;
        cursor += 1;
      }
    }
  }

  // Every mask is legal; the one with the fewest awkward runs is the one a
  // scanner has the easiest time with.
  let best: boolean[][] | null = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = modules.map((row, y) =>
      row.map((cell, x) =>
        reserved[y]![x] ? cell === true : (cell === true) !== masked(mask, y, x),
      ),
    );
    placeFormat(candidate, mask, size);
    const score = penalty(candidate, size);
    if (score < bestPenalty) {
      bestPenalty = score;
      best = candidate;
    }
  }

  return { size, modules: best! };
}

/** The grid as an SVG path, one rectangle per dark module. Drawn as a single
 *  path rather than a rectangle each, because a version-6 code is 1,681 nodes
 *  and a label page carries twenty of them. */
export function qrPath(matrix: QrMatrix): string {
  const parts: string[] = [];
  for (let y = 0; y < matrix.size; y += 1) {
    for (let x = 0; x < matrix.size; x += 1) {
      if (matrix.modules[y]![x]) parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return parts.join("");
}

/* ------------------------------------------------------------ the fiddly -- */

const masked = (mask: number, y: number, x: number) => {
  switch (mask) {
    case 0:
      return (y + x) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (y + x) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((y * x) % 2) + ((y * x) % 3) === 0;
    case 6:
      return (((y * x) % 2) + ((y * x) % 3)) % 2 === 0;
    default:
      return (((y + x) % 2) + ((y * x) % 3)) % 2 === 0;
  }
};

/**
 * The finders, the separators, the timing lines, the alignment patterns and the
 * one module that is always dark — everything a scanner looks for before it
 * reads anything, plus the fifteen places the format information will go.
 *
 * Returns which cells it claimed, because those are exactly the cells the mask
 * must not touch.
 */
function drawFunctionPatterns(modules: (boolean | null)[][], version: number, size: number) {
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const set = (y: number, x: number, on: boolean) => {
    if (y < 0 || y >= size || x < 0 || x >= size) return;
    modules[y]![x] = on;
    reserved[y]![x] = true;
  };

  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const edge = y === -1 || y === 7 || x === -1 || x === 7;
        const ring = y === 0 || y === 6 || x === 0 || x === 6;
        const core = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        set(top + y, left + x, !edge && (ring || core));
      }
    }
  }

  for (let at = 8; at < size - 8; at += 1) {
    set(6, at, at % 2 === 0);
    set(at, 6, at % 2 === 0);
  }

  // The three that would land on a finder are left out, which is what the
  // "already claimed" test is doing: the centre is the whole of the question.
  const centres = ALIGNMENT[version - 1]!;
  for (const y of centres) {
    for (const x of centres) {
      if (reserved[y]![x]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(y + dy, x + dx, Math.max(Math.abs(dy), Math.abs(dx)) !== 1);
        }
      }
    }
  }

  // The dark module, and the format information's own places — claimed now, so
  // the data stream steps over them and the mask leaves them alone.
  set(size - 8, 8, true);
  for (let at = 0; at <= 8; at += 1) {
    if (!reserved[8]![at]) set(8, at, false);
    if (!reserved[at]![8]) set(at, 8, false);
  }
  for (let at = size - 8; at < size; at += 1) {
    if (!reserved[8]![at]) set(8, at, false);
    if (!reserved[at]![8]) set(at, 8, false);
  }

  return reserved;
}

/**
 * The fifteen bits that say which level and which mask, written twice.
 *
 * Computed rather than looked up in a table of thirty-two strings: the BCH code
 * is four lines, and a table is four lines somebody has to have typed correctly.
 */
function placeFormat(modules: boolean[][], mask: number, size: number) {
  const data = (0b00 << 3) | mask; // 00 is error correction level M.
  let remainder = data;
  for (let at = 0; at < 10; at += 1) {
    remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
  }
  const bits = (((data << 10) | remainder) ^ 0x5412) & 0x7fff;
  const bit = (at: number) => ((bits >> at) & 1) === 1;

  // The first copy runs down the column beside the top-left finder and then
  // along the row under it; the second is split between the other two finders,
  // so losing a corner of the label never loses both.
  for (let at = 0; at <= 5; at += 1) modules[at]![8] = bit(at);
  modules[7]![8] = bit(6);
  modules[8]![8] = bit(7);
  modules[8]![7] = bit(8);
  for (let at = 9; at <= 14; at += 1) modules[8]![14 - at] = bit(at);

  for (let at = 0; at <= 7; at += 1) modules[8]![size - 1 - at] = bit(at);
  for (let at = 8; at <= 14; at += 1) modules[size - 15 + at]![8] = bit(at);
  modules[size - 8]![8] = true;
}

/** Long runs of one colour and solid two-by-two squares, which are the two
 *  things that make a code hard to read. The other two rules the standard names
 *  only refine the choice between masks that are already fine. */
function penalty(modules: boolean[][], size: number): number {
  let score = 0;

  const run = (at: (index: number) => boolean) => {
    let length = 1;
    for (let index = 1; index < size; index += 1) {
      if (at(index) === at(index - 1)) {
        length += 1;
        if (length === 5) score += 3;
        else if (length > 5) score += 1;
      } else {
        length = 1;
      }
    }
  };

  for (let line = 0; line < size; line += 1) {
    run((index) => modules[line]![index]!);
    run((index) => modules[index]![line]!);
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const cell = modules[y]![x];
      if (
        cell === modules[y]![x + 1] &&
        cell === modules[y + 1]![x] &&
        cell === modules[y + 1]![x + 1]
      ) {
        score += 3;
      }
    }
  }

  return score;
}

/* --------------------------------------------------------- Reed-Solomon -- */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let value = 1, at = 0; at < 255; at += 1) {
  EXP[at] = value;
  LOG[value] = at;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let at = 255; at < 512; at += 1) EXP[at] = EXP[at - 255]!;

const multiply = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

function reedSolomon(data: number[], degree: number): number[] {
  // The generator polynomial for this degree, built by multiplying out
  // (x - 2^0)(x - 2^1)… — cheaper to compute than to store six of them.
  let generator = [1];
  for (let at = 0; at < degree; at += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);
    for (let index = 0; index < generator.length; index += 1) {
      next[index] = (next[index] ?? 0) ^ generator[index]!;
      next[index + 1] = (next[index + 1] ?? 0) ^ multiply(generator[index]!, EXP[at]!);
    }
    generator = next;
  }

  const remainder = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.shift();
    remainder.push(0);
    for (let at = 0; at < degree; at += 1) {
      remainder[at] = remainder[at]! ^ multiply(generator[at + 1]!, factor);
    }
  }
  return remainder;
}
