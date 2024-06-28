import fetch from "node-fetch";
import fs from "fs";
import { decode } from "base64-arraybuffer";
import dotenv from "dotenv";

dotenv.config();

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const API_KEY = process.env.API_KEY;

const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream/with-timestamps`;

const headers = {
  "Content-Type": "application/json",
  "xi-api-key": API_KEY,
};

const data = {
  text: "Hey! I am Ursula - I fly across the galaxy to help kids become the best version of themselves. Let’s work together to turn you into a super parent!",
  model_id: "eleven_multilingual_v2",
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75,
  },
};

async function streamAudioWithTimestamps() {
  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (response.status !== 200) {
    console.error(
      `Error encountered, status: ${
        response.status
      }, content: ${await response.text()}`
    );
    return;
  }

  let audioBytes = [];
  let characters = [];
  let startTimes = [];
  let endTimes = [];
  let partialChunk = "";
  let alignmentReceived = false;
  let audioReceived = false;

  response.body.on("data", (chunk) => {
    partialChunk += chunk.toString();

    let boundaryIndex;
    while ((boundaryIndex = partialChunk.indexOf("\n")) >= 0) {
      const jsonString = partialChunk.slice(0, boundaryIndex);
      partialChunk = partialChunk.slice(boundaryIndex + 1);

      if (jsonString.trim()) {
        try {
          const responseData = JSON.parse(jsonString);

          if (responseData.alignment && !alignmentReceived) {
            alignmentReceived = true;
            console.log("Alignment received:", responseData.alignment);
          }

          if (responseData.audio_base64 && !audioReceived) {
            audioReceived = true;
            console.log("First audio chunk received");
          }

          const audioChunk = decode(responseData.audio_base64);
          audioBytes.push(...new Uint8Array(audioChunk));

          if (responseData.alignment) {
            characters.push(...responseData.alignment.characters);
            startTimes.push(
              ...responseData.alignment.character_start_times_seconds
            );
            endTimes.push(
              ...responseData.alignment.character_end_times_seconds
            );
          }
        } catch (error) {
          console.error("Error processing JSON:", error);
        }
      }
    }
  });

  response.body.on("end", () => {
    fs.writeFileSync("output.mp3", new Uint8Array(audioBytes));
    console.log({
      characters,
      startTimes,
      endTimes,
    });
  });

  // Log headers
  console.log("Response headers:", response.headers.raw());
}

streamAudioWithTimestamps().catch(console.error);
