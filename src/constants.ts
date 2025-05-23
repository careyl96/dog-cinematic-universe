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
  USER_DATA: path.join(__dirname, 'user_data'),
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
  GROQ_OUTPUT: '1364745947292106935',
}

export const EMOJIS = {
  AGREEGE: {
    name: 'Agreege',
    id: '1007597677934018570',
  },
}

export const BOT_USER_ID = '1330353040288514048'

export const PERMISSIONS = {}

export const TRIGGER_WORDS = ['dog', 'yadog', 'dawn', 'dawg', 'doug', 'dogs', 'dodd', 'doc', 'dod', 'e-dog', 'yogg']

export const TRIGGER_PHRASES = ['hey dog', 'hey doc', 'hey dawn', 'hey dawg', 'hey doug', 'you dog']

export const COMMANDS = {
  PLAY: ['play', 'plays', 'place', 'plague', 'played', 'playing'],
  QUEUE: ['queue', 'q', 'cue', 'kyu', 'kiu', 'qiu'],
  STOP: ['stop', 'pause', 'paws'],
  RESUME: ['unpause', 'resume', 'continue'],
  SKIP: ['skip', 'skit', 'next'],
  ROULETTE: ['roulette', 'roulet', 'relate', 'relete'],
  MISC: ['clear'],
}

export const animalCrossingMusic: Record<number, string> = {
  0: 'https://youtube.com/watch?v=qDnrdeNDRio',
  1: 'https://youtube.com/watch?v=LjrMm_6zmNo',
  2: 'https://youtube.com/watch?v=oPCkJqbTpaA',
  3: 'https://youtube.com/watch?v=0Gpa29MRPys',
  4: 'https://youtube.com/watch?v=ROpWMf0Md6g',
  5: 'https://youtube.com/watch?v=_qSyWo0Tm4U',
  6: 'https://youtube.com/watch?v=lS0XGL2rWTI',
  7: 'https://youtube.com/watch?v=rdVBS1lHDC4',
  8: 'https://youtube.com/watch?v=QIx22FB3FXo',
  9: 'https://youtube.com/watch?v=7Rf6gOt_LdY',
  10: 'https://youtube.com/watch?v=hkP1kOKF2Yk',
  11: 'https://youtube.com/watch?v=AKXMNP23BnA',
  12: 'https://youtube.com/watch?v=KJp488yN3VM',
  13: 'https://youtube.com/watch?v=yWWoDrUZq04',
  14: 'https://youtube.com/watch?v=gD4Hh115gOk',
  15: 'https://youtube.com/watch?v=uhnNzw4x7sE',
  16: 'https://youtube.com/watch?v=cLBhI_9njKw',
  17: 'https://youtube.com/watch?v=vc1zlXMyZow',
  18: 'https://youtube.com/watch?v=WH_rj-YzzXI',
  19: 'https://youtube.com/watch?v=AK5mUK5IQvs',
  20: 'https://youtube.com/watch?v=du10VZTTZp8',
  21: 'https://youtube.com/watch?v=HxXOrY_DtVw',
  22: 'https://youtube.com/watch?v=zANebE1wNjw',
  23: 'https://youtube.com/watch?v=5hVFsARLcV0',
}
