import net from 'net';
import { decode, encode } from '@msgpack/msgpack';
import { SEOChecker } from './index';
import fs from 'fs';

const socketPath = process.argv[2];
if (!socketPath) {
    console.error("Usage: node dist/worker.js <socket_path>");
    process.exit(1);
}

if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
}

const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    
    socket.on('data', async (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
            const len = buffer.readUInt32BE(0);
            if (buffer.length >= 4 + len) {
                const payload = buffer.subarray(4, 4 + len);
                buffer = buffer.subarray(4 + len);
                await handlePayload(socket, payload);
            } else {
                break;
            }
        }
    });

    socket.on('error', (err) => {
        console.error("Socket error:", err);
    });
});

async function handlePayload(socket: net.Socket, payload: Buffer) {
    let request: any;
    try {
        request = decode(payload);
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
    } catch (err: any) {
        sendMsg(socket, { id, success: false, error: err.message });
    }
}

function sendMsg(socket: net.Socket, msg: any) {
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
