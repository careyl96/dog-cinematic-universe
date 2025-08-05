import asyncio
import websockets
from aiohttp import web
import numpy as np
import soundfile as sf
import tempfile
import time
import json
from faster_whisper import WhisperModel

# 🎙️ Configuration
PORT = 2700
SILENCE_TIMEOUT = 2.0

# 🧠 Load Whisper model
model = WhisperModel("base", compute_type="auto")


# 👤 Per-user state
class UserState:
    def __init__(self, user_id):
        self.user_id = user_id
        self.audio_buffer = []
        self.last_audio_time = time.monotonic()
        self.websocket = None
        self.ended = False


# 🗂️ All active users
user_states = {}


# 🔄 Main WebSocket transcription loop
async def transcribe(websocket):
    print("🔌 Client connected")

    try:
        async for message in websocket:
            if isinstance(message, bytes):
                if len(message) <= 36:
                    continue

                user_id_bytes = message[:36]
                pcm_data = message[36:]
                user_id = user_id_bytes.decode("utf-8").strip("\x00")

                if user_id not in user_states:
                    user_states[user_id] = UserState(user_id)
                    user_states[user_id].websocket = websocket

                state = user_states[user_id]
                state.last_audio_time = time.monotonic()
                state.audio_buffer.append(np.frombuffer(pcm_data, dtype=np.int16))

            elif isinstance(message, str):
                try:
                    data = json.loads(message)
                    if data.get("event") == "end" and "userId" in data:
                        user_id = data["userId"]
                        if user_id in user_states:
                            user_states[user_id].ended = True
                except json.JSONDecodeError:
                    pass

            else:
                print("⚠️ Unsupported message type")
    except websockets.ConnectionClosed:
        print("❌ Client disconnected")
    finally:
        user_states.clear()


# 🛑 Finalization loop: prioritizes 'end' event, falls back to silence
async def finalize_inactive():
    while True:
        now = time.monotonic()
        to_remove = []

        for user_id, state in list(user_states.items()):
            should_finalize = False

            if state.ended:
                should_finalize = True
            elif now - state.last_audio_time > SILENCE_TIMEOUT:
                should_finalize = True

            if should_finalize and state.audio_buffer:
                pcm = np.concatenate(state.audio_buffer).astype(np.float32) / 32768.0
                with tempfile.NamedTemporaryFile(suffix=".wav") as f:
                    sf.write(f.name, pcm, samplerate=16000)
                    segments, _ = model.transcribe(f.name, beam_size=1)
                    full_text = " ".join([seg.text for seg in segments]).strip()
                    print(f"[{user_id}] 🗣️ {full_text}")

                    if state.websocket:
                        try:
                            await state.websocket.send(
                                json.dumps(
                                    {
                                        "userId": user_id,
                                        "partial": "",
                                        "fullText": full_text,
                                    }
                                )
                            )
                        except Exception as e:
                            print(f"⚠️ Failed to send to [{user_id}]: {e}")

                to_remove.append(user_id)

        for user_id in to_remove:
            del user_states[user_id]

        await asyncio.sleep(1)


# 🌐 Start WebSocket server
async def start_ws_server():
    print(f"🎙️ Faster-Whisper server running on ws://localhost:{PORT}")
    return await websockets.serve(transcribe, "0.0.0.0", PORT)


async def health_check(request):
    return web.Response(text="OK")


app = web.Application()
app.router.add_get("/health", health_check)
web_runner = web.AppRunner(app)


async def start_health_server():
    await web_runner.setup()
    site = web.TCPSite(web_runner, "0.0.0.0", 8080)
    await site.start()


# 🚀 Entrypoint
async def main():
    await start_health_server()
    await start_ws_server()
    asyncio.create_task(finalize_inactive())
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
