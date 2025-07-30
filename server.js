import https from "https";
import fs from "fs";
import { WebSocketServer } from "ws";
import { PassThrough } from "stream";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";

const REGION = "us-east-1";
const PORT = 443;
const DOMAIN = "transcribe.shellbeehaken.click";
const SAMPLE_RATE = 16000;

// Load SSL certificates (make sure these paths exist)
const serverOptions = {
  cert: fs.readFileSync(`/etc/letsencrypt/live/${DOMAIN}/fullchain.pem`),
  key: fs.readFileSync(`/etc/letsencrypt/live/${DOMAIN}/privkey.pem`),
};

const transcribeClient = new TranscribeStreamingClient({ region: REGION });

// Create HTTPS server
const server = https.createServer(serverOptions, (req, res) => {
  res.writeHead(200);
  res.end("🟢 Secure Transcribe Proxy is running over HTTPS/WSS.\n");
});

// Create WebSocket server on top of HTTPS
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  const audioStream = new PassThrough();

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: SAMPLE_RATE,
    AudioStream: (async function* () {
      for await (const chunk of audioStream) {
        yield { AudioEvent: { AudioChunk: chunk } };
      }
    })(),
  });

  let isClosed = false;

  const sendTranscribe = async () => {
    try {
      const response = await transcribeClient.send(command);

      for await (const event of response.TranscriptResultStream) {
        const results = event.TranscriptEvent?.Transcript?.Results;
        if (
          results &&
          results.length > 0 &&
          !results[0].IsPartial &&
          results[0].Alternatives?.[0]?.Transcript
        ) {
          const transcript = results[0].Alternatives[0].Transcript;
          console.log("📝 Transcript:", transcript);

          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ transcript }));
          }
        }
      }
    } catch (error) {
      console.error("❌ Transcribe error:", error);
      if (!isClosed) ws.close();
    }
  };

  sendTranscribe();

  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      audioStream.write(message);
    } else {
      console.warn("⚠️ Non-buffer message received");
    }
  });

  ws.on("close", () => {
    isClosed = true;
    console.log("🔌 Client disconnected");
    audioStream.end();
  });

  ws.on("error", (err) => {
    isClosed = true;
    console.error("💥 WebSocket error:", err);
    ws.close();
    audioStream.end();
  });
});

// Start HTTPS + WSS server
server.listen(PORT, () => {
  console.log(`🚀 Secure server listening at https://${DOMAIN}`);
});
