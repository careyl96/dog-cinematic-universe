import asyncio
import websockets
from aiohttp import web
from vosk import Model, KaldiRecognizer
import json
import time

model = Model("models/vosk-model-small-en-us-0.15")

PORT = 2700
HTTP_PORT = 8080
SILENCE_TIMEOUT = 2.0


class UserState:
    def __init__(self, user_id):
        self.user_id = user_id
        self.recognizer = KaldiRecognizer(model, 16000)
        self.recognizer.SetWords(True)
        self.last_audio_time = time.monotonic()


# 🧍 All active users
user_states = {}


# 🧠 Transcription handler
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

                # 🔄 Initialize or update user state
                if user_id not in user_states:
                    user_states[user_id] = UserState(user_id)

                state = user_states[user_id]
                state.last_audio_time = time.monotonic()

                if state.recognizer.AcceptWaveform(pcm_data):
                    result = json.loads(state.recognizer.Result())
                    full_text = result.get("text", "")
                    print(f"📝 [{user_id}] {full_text}")
                    await websocket.send(
                        json.dumps(
                            {"userId": user_id, "partial": "", "fullText": full_text}
                        )
                    )
                else:
                    partial = json.loads(state.recognizer.PartialResult())
                    partial_text = partial.get("partial", "")
                    print(f"🔄 [{user_id}][partial] {partial_text}")
                    await websocket.send(
                        json.dumps(
                            {"userId": user_id, "partial": partial_text, "fullText": ""}
                        )
                    )
            else:
                print("⚠️ Received non-binary message, ignoring.")

    except websockets.ConnectionClosed:
        print("❌ Client disconnected")
    finally:
        user_states.clear()


# 🧹 Background task to finalize on silence
async def cleanup_inactive_users():
    while True:
        now = time.monotonic()
        to_remove = []

        for user_id, state in list(user_states.items()):
            if now - state.last_audio_time > SILENCE_TIMEOUT:
                result = json.loads(state.recognizer.FinalResult())
                full_text = result.get("text", "")
                print(f"🛑 [{user_id}] Auto-finalized after silence: {full_text}")
                to_remove.append(user_id)

        for user_id in to_remove:
            del user_states[user_id]

        await asyncio.sleep(1)


# 🩺 Health check route
async def health_check(request):
    return web.Response(text="OK", status=200)


# 🌐 Start WebSocket Server
async def start_ws_server():
    print(f"🎙️  Vosk WebSocket server running on ws://localhost:{PORT}")
    return await websockets.serve(transcribe, "0.0.0.0", PORT)


# 🌐 Start HTTP Server
async def start_http_server():
    print(f"🩺  Health check available at http://localhost:{HTTP_PORT}/health")
    app = web.Application()
    app.router.add_get("/health", health_check)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", HTTP_PORT)
    await site.start()


# 🚀 Entry point
async def main():
    await start_ws_server()
    await start_http_server()
    asyncio.create_task(cleanup_inactive_users())
    await asyncio.Future()  # Keeps the process running


if __name__ == "__main__":
    asyncio.run(main())
