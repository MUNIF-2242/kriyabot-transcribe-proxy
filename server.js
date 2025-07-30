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

const certPath = `/etc/letsencrypt/live/${DOMAIN}/fullchain.pem`;
const keyPath = `/etc/letsencrypt/live/${DOMAIN}/privkey.pem`;

async function waitForCerts(maxWaitSeconds = 300, intervalSeconds = 5) {
  const maxAttempts = Math.ceil(maxWaitSeconds / intervalSeconds);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const certExists = fs.existsSync(certPath);
    const keyExists = fs.existsSync(keyPath);

    if (certExists && keyExists) {
      console.log(
        `✅ SSL certificates found after ${attempt * intervalSeconds}s`
      );
      return;
    } else {
      console.log(
        `⏳ Waiting for SSL certificates... (${attempt}/${maxAttempts})`
      );
      await new Promise((res) => setTimeout(res, intervalSeconds * 1000));
    }
  }
  throw new Error("❌ SSL certificates not found within wait time.");
}

async function startServer() {
  try {
    await waitForCerts();

    const serverOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };

    const transcribeClient = new TranscribeStreamingClient({ region: REGION });

    const server = https.createServer(serverOptions, (req, res) => {
      res.writeHead(200);
      res.end("🟢 Secure Transcribe Proxy is running over HTTPS/WSS.\n");
    });

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

    server.listen(PORT, () => {
      console.log(`🚀 Secure server listening at https://${DOMAIN}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

startServer();
