import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { encode, decode } from '@msgpack/msgpack';
import { MockServer } from '../mocks/mockServer';

/**
 * Drives the real worker (src/worker.ts, run through tsx — see
 * mcpServer.test.ts for why) over its actual length-prefixed msgpack Unix
 * socket protocol — the same protocol engine/src/crawler/renderer.rs
 * speaks as a client. Exercises the frame-length cap and synchronous
 * buffer-draining added when the shared-buffer/no-length-cap issues were
 * fixed there.
 */
function connect(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

function sendFramed(socket: net.Socket, msg: unknown): void {
  const encoded = encode(msg);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(encoded.length, 0);
  socket.write(lenBuf);
  socket.write(Buffer.from(encoded));
}

/** Reads framed msgpack messages off a socket, dispatching by id. */
class FrameReader {
  private buffer = Buffer.alloc(0);
  private pending = new Map<number, (msg: Record<string, unknown>) => void>();

  constructor(socket: net.Socket) {
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 4) {
        const len = this.buffer.readUInt32BE(0);
        if (this.buffer.length < 4 + len) break;
        const payload = this.buffer.subarray(4, 4 + len);
        this.buffer = this.buffer.subarray(4 + len);
        const msg = decode(payload) as Record<string, unknown>;
        const id = msg.id as number;
        const resolve = this.pending.get(id);
        if (resolve) {
          this.pending.delete(id);
          resolve(msg);
        }
      }
    });
  }

  waitFor(id: number): Promise<Record<string, unknown>> {
    return new Promise((resolve) => this.pending.set(id, resolve));
  }
}

describe('worker.ts', () => {
  let mockServer: MockServer;
  let proc: ChildProcessWithoutNullStreams;
  let socketPath: string;
  let socket: net.Socket;
  let reader: FrameReader;

  beforeAll(async () => {
    mockServer = new MockServer(3459);
    await mockServer.start();

    socketPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-worker-test-')), 'worker.sock');
    const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    proc = spawn(tsxBin, ['src/worker.ts', socketPath], { cwd: process.cwd() });

    // Wait for the socket file to appear.
    for (let i = 0; i < 50; i++) {
      if (fs.existsSync(socketPath)) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    socket = await connect(socketPath);
    reader = new FrameReader(socket);
  }, 20000);

  afterAll(async () => {
    socket?.destroy();
    proc?.kill();
    await mockServer.stop();
  });

  it('responds to a ping with a pong carrying the same id', async () => {
    const waiting = reader.waitFor(1);
    sendFramed(socket, { id: 1, type: 'ping' });
    const res = await waiting;
    expect(res.type).toBe('pong');
    expect(res.id).toBe(1);
  });

  it('runs a real audit and returns a successful report correlated by id', async () => {
    const waiting = reader.waitFor(2);
    sendFramed(socket, { id: 2, url: mockServer.getUrl('/optimal') });
    const res = await waiting;
    expect(res.success).toBe(true);
    expect(res.id).toBe(2);
    const report = res.report as { url: string; checks: unknown };
    expect(report.url).toBe(mockServer.getUrl('/optimal'));
    expect(report.checks).toBeDefined();
  }, 60000);

  it('closes the connection on an oversized frame instead of trying to buffer it', async () => {
    // Hand-craft a frame claiming a length far past the worker's cap
    // (64MB) without actually sending that many bytes — the worker must
    // reject based on the length prefix alone, not wait for the bytes.
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(100 * 1024 * 1024, 0);
    const closed = new Promise<void>((resolve) => socket.once('close', resolve));
    socket.write(lenBuf);
    await closed;
    expect(socket.destroyed).toBe(true);
  });
});
