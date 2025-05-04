import path from 'node:path'

const __dirname = path.resolve()

export const PATH = {
  AUDIO_FILES: {
    DEFAULT: path.join(__dirname, 'audio_files/default'),
    GENERATED: {
      PCM: path.join(__dirname, 'audio_files/generated/pcm'),
      WAV: path.join(__dirname, 'audio_files/generated/wav'),
      TTS: path.join(__dirname, 'audio_files/generated/tts'),
      YOUTUBE: path.join(__dirname, 'audio_files/generated/youtube'),
    },
  },
  CHAT_HISTORY: path.join(__dirname, 'chat_history'),
  MUSIC_BOT_HISTORY: path.join(__dirname, 'music_bot_history'),
  COMMANDS: path.join(__dirname, 'src/commands'),
  EVENTS: path.join(__dirname, 'src/events'),
}

export const AUDIO_FILES = {
  BA: path.join(PATH.AUDIO_FILES.DEFAULT, 'ba.mp3'),
  SNIFF: path.join(PATH.AUDIO_FILES.DEFAULT, 'sniffa.mp3'),
  WHIMPER: path.join(PATH.AUDIO_FILES.DEFAULT, 'whimper.mp3'),
  ELEVATOR_MUSIC: path.join(PATH.AUDIO_FILES.DEFAULT, 'elevator_music.mp3'),
}

export const TEXT_CHANNELS = {
  MUSIC_BOT: '541924016412426242',
}

export const BOT_USER_ID = '1330353040288514048'

export const PERMISSIONS = {}
