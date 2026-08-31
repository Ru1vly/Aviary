import net from 'net';
import { decode, encode } from '@msgpack/msgpack';
import { SEOChecker } from './index';
import { SEOReport } from './types';
import { categorizeError } from './errors/index.js';
import fs from 'fs';

interface PingRequest {
  type: 'ping';
  id: string | number;
}

interface AuditRequest {
  type?: undefined;
  id: string | number;
  url: string;
}

type WorkerRequest = PingRequest | AuditRequest;

type WorkerResponse =
  | { id: string | number; type: 'pong' }
  | { id: string | number; success: true; report: SEOReport }
  | { id: string | number; success: false; error: string };

const socketPath = process.argv[2];
if (!socketPath) {
    console.error("Usage: node dist/worker.js <socket_path>");
    process.exit(1);
}

if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
}

// A single msgpack-encoded SEOReport (230+ checks, each with a message and
// details) can legitimately run to several hundred KB; this caps well above
// that while still bounding how much memory a corrupted or malicious
// 4-byte length prefix can make the process allocate before being read.
const MAX_FRAME_BYTES = 64 * 1024 * 1024;

const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);

    // Deliberately not `async`: every complete frame is extracted from
    // `buffer` in one synchronous pass first, and only then dispatched to
    // handlePayload (fire-and-forget, not awaited here). Await-ing
    // handlePayload directly inside this loop — the previous shape — meant
    // a second 'data' event could start mutating the same outer `buffer`
    // while this invocation was still suspended mid-loop; parsing
    // everything up front removes any await between reading and mutating
    // `buffer`, so there's nothing left for an overlapping event to race.
    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        const payloads: Buffer[] = [];
        while (buffer.length >= 4) {
            const len = buffer.readUInt32BE(0);
            if (len > MAX_FRAME_BYTES) {
                console.error(`Rejecting oversized frame (${len} bytes > ${MAX_FRAME_BYTES}), closing connection`);
                socket.destroy();
                return;
            }
            if (buffer.length < 4 + len) break;
            payloads.push(buffer.subarray(4, 4 + len));
            buffer = buffer.subarray(4 + len);
        }

        for (const payload of payloads) {
            void handlePayload(socket, payload);
        }
    });

    socket.on('error', (err) => {
        console.error("Socket error:", err);
    });
});

async function handlePayload(socket: net.Socket, payload: Buffer) {
    let request: WorkerRequest;
    try {
        request = decode(payload) as WorkerRequest;
    } catch (err) {
        console.error("Failed to decode msgpack:", err);
        return;
    }

    if (request.type === 'ping') {
        sendMsg(socket, { id: request.id, type: 'pong' });
        return;
    }

    const { id, url } = request;
    try {
        const checker = new SEOChecker({ url, headless: true });
        const report = await checker.check();
        sendMsg(socket, { id, success: true, report });
    } catch (err) {
        sendMsg(socket, { id, success: false, error: categorizeError(err).message });
    }
}

function sendMsg(socket: net.Socket, msg: WorkerResponse) {
    try {
        const encoded = encode(msg);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(encoded.length, 0);
        socket.write(lenBuf);
        socket.write(Buffer.from(encoded));
    } catch (err) {
        console.error("Failed to encode/send msgpack:", err);
    }
}

server.listen(socketPath, () => {
    console.log(`Worker listening on ${socketPath}`);
});

process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
});
