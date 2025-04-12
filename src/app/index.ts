// server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import * as mediasoup from 'mediasoup';
import cors from 'cors';
import type { types } from 'mediasoup';

// Initialize Express app
const app = express();
app.use(cors());
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// MediaSoup objects
let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;
const transports: Map<string, mediasoup.types.WebRtcTransport> = new Map();
const producers: Map<string, mediasoup.types.Producer> = new Map();

// MediaSoup settings
const mediaCodecs = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000,
        },
    },
    {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
        },
    },
];

// Define a custom type that extends the Producer with transportId
interface CustomProducer extends mediasoup.types.Producer {
    transportId: string;
}

// Create a MediaSoup worker
const createWorker = async (): Promise<types.Worker> => {
    const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
    });

    console.log(`MediaSoup Worker created [pid: ${worker.pid}]`);

    worker.on('died', () => {
        console.error('MediaSoup Worker died, exiting in 2 seconds...');
        setTimeout(() => process.exit(1), 2000);
    });

    return worker;
};

// Initialize MediaSoup
const initializeMediaSoup = async (): Promise<void> => {
    worker = await createWorker();
    router = await worker.createRouter({ mediaCodecs: mediaCodecs as types.RtpCodecCapability[] });
    console.log('MediaSoup router created');
};

// Create a WebRTC transport
const createWebRtcTransport = async (): Promise<{
    transport: types.WebRtcTransport;
    params: {
        id: string;
        iceParameters: any;
        iceCandidates: any;
        dtlsParameters: any;
    };
}> => {
    const transport = await router.createWebRtcTransport({
        listenIps: [
            {
                ip: '0.0.0.0', // Replace with your server's IP in production
                announcedIp: '127.0.0.1', // Replace with your public IP in production
            },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    });

    transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
            transport.close();
        }
    });

    transport.on('@close', () => {
        console.log(`Transport closed [id: ${transport.id}]`);
        transports.delete(transport.id);
    });

    // Store the transport
    transports.set(transport.id, transport);

    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        },
    };
};

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`Client connected [id: ${socket.id}]`);

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected [id: ${socket.id}]`);

        // Close all associated transports and producers
        for (const [transportId, transport] of transports.entries()) {
            for (const [producerId, producer] of producers.entries()) {
                if ((producer as CustomProducer).transportId === transportId) {
                    producer.close();
                    producers.delete(producerId);
                }
            }
            transport.close();
            transports.delete(transportId);
        }
    });

    // Get router RTP capabilities
    socket.on('getRouterRtpCapabilities', (callback) => {
        callback({ rtpCapabilities: router.rtpCapabilities });
    });

    // Create WebRTC transport
    socket.on('createWebRtcTransport', async (callback) => {
        try {
            const { transport, params } = await createWebRtcTransport();
            callback({ params });
        } catch (error) {
            console.error('Error creating WebRTC transport:', error);
            callback({ error: (error as Error).message });
        }
    });

    // Connect transport
    socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
        try {
            const transport = transports.get(transportId);
            if (!transport) {
                throw new Error(`Transport not found [id: ${transportId}]`);
            }

            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (error) {
            console.error('Error connecting transport:', error);
            callback({ error: (error as Error).message });
        }
    });

    // Produce (send media)
    socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
        try {
            const transport = transports.get(transportId);
            if (!transport) {
                throw new Error(`Transport not found [id: ${transportId}]`);
            }

            const producer = (await transport.produce({ kind, rtpParameters })) as CustomProducer;
            producer.transportId = transportId;

            producer.on('transportclose', () => {
                console.log(`Producer transport closed [id: ${producer.id}]`);
                producer.close();
                producers.delete(producer.id);
            });

            // Store the producer
            producers.set(producer.id, producer);

            callback({ id: producer.id });

            console.log(`Producer created [id: ${producer.id}, kind: ${kind}, socketId: ${socket.id}]`);
        } catch (error) {
            console.error('Error producing:', error);
            callback({ error: (error as Error).message });
        }
    });
});

// Start the server
const start = async (): Promise<void> => {
    await initializeMediaSoup();

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

start();
