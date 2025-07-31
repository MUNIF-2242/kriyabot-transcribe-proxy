import http from "http";
import { WebSocketServer } from "ws";
// Uncomment these lines when ready to enable live transcription
// import { PassThrough } from "stream";
// import {
//   TranscribeStreamingClient,
//   StartStreamTranscriptionCommand,
// } from "@aws-sdk/client-transcribe-streaming";

// const REGION = "us-east-1";
// const SAMPLE_RATE = 16000;
// const transcribeClient = new TranscribeStreamingClient({ region: REGION });

const PORT = 8080;
const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  // Simulate a dummy transcript message to test frontend UI
  ws.send(JSON.stringify({ transcript: "🧠 What is kriyakarak?" }));

  // Placeholder for AWS Transcribe streaming logic
  /*
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

  transcribeClient.send(command).then(async (response) => {
    try {
      for await (const event of response.TranscriptResultStream) {
        const results = event.TranscriptEvent?.Transcript?.Results;
        if (
          results?.length &&
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
    } catch (err) {
      console.error("❌ Transcribe error:", err);
      ws.close();
    }
  });

  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      audioStream.write(message);
    }
  });
  */

  ws.on("close", () => {
    console.log("🔌 Client disconnected");
    // if (audioStream) audioStream.end();
  });

  ws.on("error", (err) => {
    console.error("💥 WebSocket error:", err);
    ws.close();
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Mock server running at http://localhost:${PORT}`);
});
