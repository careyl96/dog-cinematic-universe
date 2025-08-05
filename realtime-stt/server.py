import asyncio
import websockets
import struct
import json
import time
from RealtimeSTT import AudioToTextRecorderClient

class UserState:
    def __init__(self, user_id):
        self.user_id = user_id
        self.audio_buffer = []

# 🗂️ All active users
user_states = {}


def preprocess_text(text):
    text = text.lstrip()
    if text.startswith("..."):
        text = text[3:].lstrip()
    if text:
        text = text[0].upper() + text[1:]
    return text


def process_text(text):
    text = preprocess_text(text).rstrip()
    if text.endswith("..."):
        text = text[:-2]
    if text:
        print(text)


async def main():
    recorder = AudioToTextRecorderClient(
        model="small.en",
        realtime_model_type="tiny.en",
        language="en",
        silero_sensitivity=0.05,
        webrtc_sensitivity=3,
        post_speech_silence_duration=0.7,
        min_length_of_recording=1.1,
        min_gap_between_recordings=0,
        enable_realtime_transcription=True,
        realtime_processing_pause=0.02,
        on_realtime_transcription_update=process_text,
        silero_deactivity_detection=True,
        early_transcription_on_silence=0,
        beam_size=5,
        beam_size_realtime=3,
        no_log_file=True,
        silero_use_onnx=True,
        faster_whisper_vad_filter=False,
        use_microphone=False,
    )
    await recorder.start()

if __name__ == "__main__":
    asyncio.run(main())
