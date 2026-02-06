// Web Worker for streaming file hash calculation
// Uses 1MB chunks to handle files of any size without OOM

// ============================================================================
// CRC32 Implementation (Incremental)
// ============================================================================

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

class Crc32Calculator {
  private crc: number;

  constructor() {
    this.crc = 0xffffffff;
  }

  update(data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.crc = CRC32_TABLE[(this.crc ^ data[i]) & 0xff] ^ (this.crc >>> 8);
    }
  }

  finalize(): string {
    return ((this.crc ^ 0xffffffff) >>> 0)
      .toString(16)
      .toUpperCase()
      .padStart(8, "0");
  }
}

// ============================================================================
// MD5 Implementation (Incremental)
// ============================================================================

class Md5Calculator {
  private state: Uint32Array;
  private buffer: Uint8Array;
  private bufferLength: number;
  private totalLength: number;

  constructor() {
    this.state = new Uint32Array([
      0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476,
    ]);
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.totalLength = 0;
  }

  update(data: Uint8Array): void {
    this.totalLength += data.length;
    let offset = 0;

    // If there's data in the buffer, try to fill it
    if (this.bufferLength > 0) {
      const bytesToCopy = Math.min(64 - this.bufferLength, data.length);
      this.buffer.set(data.subarray(0, bytesToCopy), this.bufferLength);
      this.bufferLength += bytesToCopy;
      offset = bytesToCopy;

      if (this.bufferLength === 64) {
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }
    }

    // Process full blocks from the input
    while (offset + 64 <= data.length) {
      this.processBlock(data.subarray(offset, offset + 64));
      offset += 64;
    }

    // Store remaining bytes in buffer
    if (offset < data.length) {
      const remaining = data.subarray(offset);
      this.buffer.set(remaining, 0);
      this.bufferLength = remaining.length;
    }
  }

  private processBlock(block: Uint8Array): void {
    const s = this.state;
    const x = new Uint32Array(16);

    // Convert bytes to 32-bit words
    for (let i = 0; i < 16; i++) {
      x[i] =
        block[i * 4] |
        (block[i * 4 + 1] << 8) |
        (block[i * 4 + 2] << 16) |
        (block[i * 4 + 3] << 24);
    }

    let [a, b, c, d] = [s[0], s[1], s[2], s[3]];

    // Round 1
    [a, b, c, d] = this.ff(a, b, c, d, x[0], 7, 0xd76aa478);
    [d, a, b, c] = this.ff(d, a, b, c, x[1], 12, 0xe8c7b756);
    [c, d, a, b] = this.ff(c, d, a, b, x[2], 17, 0x242070db);
    [b, c, d, a] = this.ff(b, c, d, a, x[3], 22, 0xc1bdceee);
    [a, b, c, d] = this.ff(a, b, c, d, x[4], 7, 0xf57c0faf);
    [d, a, b, c] = this.ff(d, a, b, c, x[5], 12, 0x4787c62a);
    [c, d, a, b] = this.ff(c, d, a, b, x[6], 17, 0xa8304613);
    [b, c, d, a] = this.ff(b, c, d, a, x[7], 22, 0xfd469501);
    [a, b, c, d] = this.ff(a, b, c, d, x[8], 7, 0x698098d8);
    [d, a, b, c] = this.ff(d, a, b, c, x[9], 12, 0x8b44f7af);
    [c, d, a, b] = this.ff(c, d, a, b, x[10], 17, 0xffff5bb1);
    [b, c, d, a] = this.ff(b, c, d, a, x[11], 22, 0x895cd7be);
    [a, b, c, d] = this.ff(a, b, c, d, x[12], 7, 0x6b901122);
    [d, a, b, c] = this.ff(d, a, b, c, x[13], 12, 0xfd987193);
    [c, d, a, b] = this.ff(c, d, a, b, x[14], 17, 0xa679438e);
    [b, c, d, a] = this.ff(b, c, d, a, x[15], 22, 0x49b40821);

    // Round 2
    [a, b, c, d] = this.gg(a, b, c, d, x[1], 5, 0xf61e2562);
    [d, a, b, c] = this.gg(d, a, b, c, x[6], 9, 0xc040b340);
    [c, d, a, b] = this.gg(c, d, a, b, x[11], 14, 0x265e5a51);
    [b, c, d, a] = this.gg(b, c, d, a, x[0], 20, 0xe9b6c7aa);
    [a, b, c, d] = this.gg(a, b, c, d, x[5], 5, 0xd62f105d);
    [d, a, b, c] = this.gg(d, a, b, c, x[10], 9, 0x02441453);
    [c, d, a, b] = this.gg(c, d, a, b, x[15], 14, 0xd8a1e681);
    [b, c, d, a] = this.gg(b, c, d, a, x[4], 20, 0xe7d3fbc8);
    [a, b, c, d] = this.gg(a, b, c, d, x[9], 5, 0x21e1cde6);
    [d, a, b, c] = this.gg(d, a, b, c, x[14], 9, 0xc33707d6);
    [c, d, a, b] = this.gg(c, d, a, b, x[3], 14, 0xf4d50d87);
    [b, c, d, a] = this.gg(b, c, d, a, x[8], 20, 0x455a14ed);
    [a, b, c, d] = this.gg(a, b, c, d, x[13], 5, 0xa9e3e905);
    [d, a, b, c] = this.gg(d, a, b, c, x[2], 9, 0xfcefa3f8);
    [c, d, a, b] = this.gg(c, d, a, b, x[7], 14, 0x676f02d9);
    [b, c, d, a] = this.gg(b, c, d, a, x[12], 20, 0x8d2a4c8a);

    // Round 3
    [a, b, c, d] = this.hh(a, b, c, d, x[5], 4, 0xfffa3942);
    [d, a, b, c] = this.hh(d, a, b, c, x[8], 11, 0x8771f681);
    [c, d, a, b] = this.hh(c, d, a, b, x[11], 16, 0x6d9d6122);
    [b, c, d, a] = this.hh(b, c, d, a, x[14], 23, 0xfde5380c);
    [a, b, c, d] = this.hh(a, b, c, d, x[1], 4, 0xa4beea44);
    [d, a, b, c] = this.hh(d, a, b, c, x[4], 11, 0x4bdecfa9);
    [c, d, a, b] = this.hh(c, d, a, b, x[7], 16, 0xf6bb4b60);
    [b, c, d, a] = this.hh(b, c, d, a, x[10], 23, 0xbebfbc70);
    [a, b, c, d] = this.hh(a, b, c, d, x[13], 4, 0x289b7ec6);
    [d, a, b, c] = this.hh(d, a, b, c, x[0], 11, 0xeaa127fa);
    [c, d, a, b] = this.hh(c, d, a, b, x[3], 16, 0xd4ef3085);
    [b, c, d, a] = this.hh(b, c, d, a, x[6], 23, 0x04881d05);
    [a, b, c, d] = this.hh(a, b, c, d, x[9], 4, 0xd9d4d039);
    [d, a, b, c] = this.hh(d, a, b, c, x[12], 11, 0xe6db99e5);
    [c, d, a, b] = this.hh(c, d, a, b, x[15], 16, 0x1fa27cf8);
    [b, c, d, a] = this.hh(b, c, d, a, x[2], 23, 0xc4ac5665);

    // Round 4
    [a, b, c, d] = this.ii(a, b, c, d, x[0], 6, 0xf4292244);
    [d, a, b, c] = this.ii(d, a, b, c, x[7], 10, 0x432aff97);
    [c, d, a, b] = this.ii(c, d, a, b, x[14], 15, 0xab9423a7);
    [b, c, d, a] = this.ii(b, c, d, a, x[5], 21, 0xfc93a039);
    [a, b, c, d] = this.ii(a, b, c, d, x[12], 6, 0x655b59c3);
    [d, a, b, c] = this.ii(d, a, b, c, x[3], 10, 0x8f0ccc92);
    [c, d, a, b] = this.ii(c, d, a, b, x[10], 15, 0xffeff47d);
    [b, c, d, a] = this.ii(b, c, d, a, x[1], 21, 0x85845dd1);
    [a, b, c, d] = this.ii(a, b, c, d, x[8], 6, 0x6fa87e4f);
    [d, a, b, c] = this.ii(d, a, b, c, x[15], 10, 0xfe2ce6e0);
    [c, d, a, b] = this.ii(c, d, a, b, x[6], 15, 0xa3014314);
    [b, c, d, a] = this.ii(b, c, d, a, x[13], 21, 0x4e0811a1);
    [a, b, c, d] = this.ii(a, b, c, d, x[4], 6, 0xf7537e82);
    [d, a, b, c] = this.ii(d, a, b, c, x[11], 10, 0xbd3af235);
    [c, d, a, b] = this.ii(c, d, a, b, x[2], 15, 0x2ad7d2bb);
    [b, c, d, a] = this.ii(b, c, d, a, x[9], 21, 0xeb86d391);

    s[0] = (s[0] + a) >>> 0;
    s[1] = (s[1] + b) >>> 0;
    s[2] = (s[2] + c) >>> 0;
    s[3] = (s[3] + d) >>> 0;
  }

  private ff(
    a: number,
    b: number,
    c: number,
    d: number,
    x: number,
    s: number,
    ac: number,
  ): [number, number, number, number] {
    a = (a + ((b & c) | (~b & d)) + x + ac) >>> 0;
    a = ((a << s) | (a >>> (32 - s))) >>> 0;
    a = (a + b) >>> 0;
    return [a, b, c, d];
  }

  private gg(
    a: number,
    b: number,
    c: number,
    d: number,
    x: number,
    s: number,
    ac: number,
  ): [number, number, number, number] {
    a = (a + ((b & d) | (c & ~d)) + x + ac) >>> 0;
    a = ((a << s) | (a >>> (32 - s))) >>> 0;
    a = (a + b) >>> 0;
    return [a, b, c, d];
  }

  private hh(
    a: number,
    b: number,
    c: number,
    d: number,
    x: number,
    s: number,
    ac: number,
  ): [number, number, number, number] {
    a = (a + (b ^ c ^ d) + x + ac) >>> 0;
    a = ((a << s) | (a >>> (32 - s))) >>> 0;
    a = (a + b) >>> 0;
    return [a, b, c, d];
  }

  private ii(
    a: number,
    b: number,
    c: number,
    d: number,
    x: number,
    s: number,
    ac: number,
  ): [number, number, number, number] {
    a = (a + (c ^ (b | ~d)) + x + ac) >>> 0;
    a = ((a << s) | (a >>> (32 - s))) >>> 0;
    a = (a + b) >>> 0;
    return [a, b, c, d];
  }

  finalize(): string {
    // Padding
    const totalBits = this.totalLength * 8;
    const paddingLength =
      (this.bufferLength < 56 ? 56 : 120) - this.bufferLength;

    this.buffer[this.bufferLength] = 0x80;
    for (
      let i = this.bufferLength + 1;
      i < this.bufferLength + paddingLength;
      i++
    ) {
      this.buffer[i] = 0;
    }

    // If we need a second block
    if (this.bufferLength >= 56) {
      this.processBlock(this.buffer.subarray(0, 64));
      this.buffer.fill(0, 0, 56);
    }

    // Append length
    const view = new DataView(this.buffer.buffer);
    view.setUint32(56, totalBits & 0xffffffff, true);
    view.setUint32(60, Math.floor(totalBits / 0x100000000), true);
    this.processBlock(this.buffer.subarray(0, 64));

    // Convert to hex string
    const result = new Uint8Array(16);
    const view2 = new DataView(result.buffer);
    for (let i = 0; i < 4; i++) {
      view2.setUint32(i * 4, this.state[i], true);
    }

    return Array.from(result)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// ============================================================================
// SHA1 Implementation (Incremental)
// ============================================================================

class Sha1Calculator {
  private state: Uint32Array;
  private buffer: Uint8Array;
  private bufferLength: number;
  private totalLength: number;

  constructor() {
    this.state = new Uint32Array([
      0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0,
    ]);
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.totalLength = 0;
  }

  update(data: Uint8Array): void {
    this.totalLength += data.length;
    let offset = 0;

    // If there's data in the buffer, try to fill it
    if (this.bufferLength > 0) {
      const bytesToCopy = Math.min(64 - this.bufferLength, data.length);
      this.buffer.set(data.subarray(0, bytesToCopy), this.bufferLength);
      this.bufferLength += bytesToCopy;
      offset = bytesToCopy;

      if (this.bufferLength === 64) {
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }
    }

    // Process full blocks from the input
    while (offset + 64 <= data.length) {
      this.processBlock(data.subarray(offset, offset + 64));
      offset += 64;
    }

    // Store remaining bytes in buffer
    if (offset < data.length) {
      const remaining = data.subarray(offset);
      this.buffer.set(remaining, 0);
      this.bufferLength = remaining.length;
    }
  }

  private processBlock(block: Uint8Array): void {
    const s = this.state;
    const w = new Uint32Array(80);

    // Convert bytes to 32-bit words
    for (let i = 0; i < 16; i++) {
      w[i] =
        (block[i * 4] << 24) |
        (block[i * 4 + 1] << 16) |
        (block[i * 4 + 2] << 8) |
        block[i * 4 + 3];
    }

    // Extend to 80 words
    for (let i = 16; i < 80; i++) {
      const val = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (val << 1) | (val >>> 31);
    }

    let [a, b, c, d, e] = [s[0], s[1], s[2], s[3], s[4]];

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;

      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = ((a << 5) | (a >>> 27)) + f + e + k + w[i];
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp >>> 0;
    }

    s[0] = (s[0] + a) >>> 0;
    s[1] = (s[1] + b) >>> 0;
    s[2] = (s[2] + c) >>> 0;
    s[3] = (s[3] + d) >>> 0;
    s[4] = (s[4] + e) >>> 0;
  }

  finalize(): string {
    // Padding
    const totalBits = this.totalLength * 8;
    const paddingLength =
      (this.bufferLength < 56 ? 56 : 120) - this.bufferLength;

    this.buffer[this.bufferLength] = 0x80;
    for (
      let i = this.bufferLength + 1;
      i < this.bufferLength + paddingLength;
      i++
    ) {
      this.buffer[i] = 0;
    }

    // If we need a second block
    if (this.bufferLength >= 56) {
      this.processBlock(this.buffer.subarray(0, 64));
      this.buffer.fill(0, 0, 56);
    }

    // Append length
    const view = new DataView(this.buffer.buffer);
    view.setUint32(56, Math.floor(totalBits / 0x100000000), false);
    view.setUint32(60, totalBits & 0xffffffff, false);
    this.processBlock(this.buffer.subarray(0, 64));

    // Convert to hex string
    return Array.from(this.state)
      .map((v) => v.toString(16).padStart(8, "0"))
      .join("");
  }
}

// ============================================================================
// Worker Implementation
// ============================================================================

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

// Track active operations for cancellation
const activeOperations = new Map<string, boolean>();

// Worker message types
interface HashFileMessage {
  type: "HASH_FILE";
  file: File;
  fileId: string;
}

interface CancelMessage {
  type: "CANCEL";
  fileId: string;
}

type WorkerMessage = HashFileMessage | CancelMessage;

// Response types
interface ProgressMessage {
  type: "PROGRESS";
  fileId: string;
  progress: number;
}

interface CompleteMessage {
  type: "COMPLETE";
  fileId: string;
  hashes: {
    md5: string;
    sha1: string;
    crc32: string;
  };
}

interface ErrorMessage {
  type: "ERROR";
  fileId: string;
  error: string;
  fatal: boolean;
}

async function hashFile(file: File, fileId: string): Promise<void> {
  activeOperations.set(fileId, true);

  try {
    const md5Calc = new Md5Calculator();
    const sha1Calc = new Sha1Calculator();
    const crc32Calc = new Crc32Calculator();

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      // Check for cancellation
      if (!activeOperations.get(fileId)) {
        return;
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const buffer = await chunk.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Update all three hashes incrementally
      md5Calc.update(data);
      sha1Calc.update(data);
      crc32Calc.update(data);

      // Send progress update
      const progress = ((chunkIndex + 1) / totalChunks) * 100;
      const progressMsg: ProgressMessage = {
        type: "PROGRESS",
        fileId,
        progress,
      };
      self.postMessage(progressMsg);
    }

    // Finalize all hashes
    const md5 = md5Calc.finalize();
    const sha1 = sha1Calc.finalize();
    const crc32 = crc32Calc.finalize();

    const completeMsg: CompleteMessage = {
      type: "COMPLETE",
      fileId,
      hashes: { md5, sha1, crc32 },
    };
    self.postMessage(completeMsg);
  } catch (error) {
    const isOutOfMemory =
      error instanceof Error &&
      (error.message.includes("allocation") ||
        error.message.includes("memory") ||
        error.name === "RangeError");

    const errorMsg: ErrorMessage = {
      type: "ERROR",
      fileId,
      error: error instanceof Error ? error.message : "Unknown error",
      fatal: isOutOfMemory,
    };
    self.postMessage(errorMsg);
  } finally {
    activeOperations.delete(fileId);
  }
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "HASH_FILE":
      hashFile(message.file, message.fileId);
      break;
    case "CANCEL":
      activeOperations.set(message.fileId, false);
      break;
    default:
      console.warn("Unknown message type in hash worker:", message);
  }
};

// Export for TypeScript
export {};
