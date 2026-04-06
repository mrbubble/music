

function addNotes(notes, instrument, channel) {
  let pos = 0;
  for (note of notes) {
    instrument.playNoteAt(channel, note, pos);
    pos += note.durationTicks;
  }
}

class Player {
  constructor() {
    this.init();
  }

  reset() {
    this.ctx.close();
    this.init();
  }

  init() {
    this.ctx = new AudioContext();
    this.ctx.suspend();
    this.channels = [this.createChannel(), this.createChannel(), this.createChannel()]
  }

  start() {
    this.ctx.resume();
  }

  createChannel() {
    const osc = new OscillatorNode(this.ctx, {
      type: "square",
      frequency: 440,
    });
    const env = new GainNode(this.ctx);
    osc.connect(env).connect(this.ctx.destination);
    osc.start(this.ctx.currentTime);
    env.gain.setValueAtTime(0, this.ctx.currentTime);
    return new Channel(osc, env, this.ctx.currentTime);
  }
}

class Channel {
  constructor(osc, env, now) {
    this.osc = osc;
    this.env = env;
    this.now = now;
  }

  setFrequencyAt(value, time) {
    this.osc.frequency.setValueAtTime(value, this.now + time);
  }
  setVolumeAt(value, time) {
    this.env.gain.setValueAtTime(this.volumeToAmplitude(value), this.now + time)
  }

  volumeToAmplitude(volume) {
    if (volume == 0) return 0.0;
    return (2.0 ** ((volume - 15.0)  / 2.0));
  }
}

const notesTable = {
  "A": 9,
  "B": 11,
  "C": 0,
  "D": 2,
  "E": 4,
  "F": 5,
  "G": 7,
}
class Note {
  constructor(opt) {
    const name = (opt.name || "A").toUpperCase();
    const alter = opt.alter || 0;
    const octave = opt.octave || 4;
    const noteIndex = (notesTable[name] + alter) + 12 * (octave + 1);
    this.frequency = 440 * 2 ** ((noteIndex - 69) / 12);
    this.volume = opt.volume || 0;
    this.durationTicks = opt.durationTicks || 8;
  }
}

class SquareSynth {
  constructor() {
    this.tick = 1/60;
  }
  playNoteAt(channel, note, timeTicks) {
      const time = timeTicks / 60;
      channel.setFrequencyAt(note.frequency, time);
      channel.setVolumeAt(note.volume, time);
      channel.setVolumeAt(0, time + (note.durationTicks / 60));
   }
}

class KnightmarePiano {
  constructor() {
    this.tick = 1/60;
  }
  playNoteAt(channel, note, timeTicks) {
    const time = timeTicks / 60;
    channel.setFrequencyAt(note.frequency, time);
    const volume = note.volume;
    const decayRate = 1;
    const sustainVolume = volume - 2;
    const totalDuration = note.durationTicks;
    const noteOnDuration = totalDuration - 4;
    let t = time;
    for (let vol of konamiEnvelope(volume, decayRate, sustainVolume, totalDuration, noteOnDuration)) {
      channel.setVolumeAt(vol, t);
      t += this.tick;
    }
    channel.setVolumeAt(0, t);
  }
}

function* konamiEnvelope(volume, decayRate, sustainVolume, totalDurationTicks, noteOnDurationTicks) {
  for (ticks = 0; ticks < totalDurationTicks; ticks++) {
    yield Math.round(volume);
    if (volume > sustainVolume || ticks >= noteOnDurationTicks) {
      volume -= decayRate;
    }
  }
}

class PlayEngine {
  constructor() {
    this.notes = [];
    this.octave = 4;
    this.tempo = 150;
    this.length = 4;
    this.volume = 10;
  }

  setTempo(value) {
    this.tempo = value;
  }
  setVolume(value) {
    this.volume = value;
  }
  setLength(value) {
    this.length = value;
  }
  setOctave(value) {
    this.octave = value;
  }
  addNote({name = 'A', alter = 0, length = this.length}) {
    this.notes.push(new Note({name: name, alter:alter, octave: this.octave, volume: this.volume, durationTicks: this.lengthToTicks(length)}));
  }
  addRest(length = this.length) {
    this.notes.push(new Note({volume: 0, durationTicks: this.lengthToTicks(length)}));
  }

  lengthToTicks(length) {
    if (Array.isArray(length)) {
      return length.map(it => this.lengthToTicks(it)).reduce((acc, it) => acc + it, 0);
    }
    return 14400 / (this.tempo * length);
  }
}

class PlayTokenizer {
  constructor(str) {
    this.str = str.replace(/\s/g, "").toUpperCase();
  }
  consumeChar() {
    let c = this.str.charAt(0);
    this.str = this.str.substring(1);
    return c;
  }
  consumeNumber() {
    let value = 0;
    while (/\d/.test(this.str.charAt(0))) {
      value = value * 10 + parseInt(this.consumeChar());
    }
    return value;
  }
  consumeAlter() {
    if (/[+#]/.test(this.str.charAt(0))) {
      this.consumeChar();
      return 1;
    }
    if (this.str.charAt(0) == '-') {
      this.consumeChar();
      return -1;
    }
    return 0;
  }
  consumeLength() {
    if (!/\d/.test(this.str.charAt(0))) {
      return undefined;
    }
    let values = [this.consumeNumber()];
    while (this.str.charAt(0) == '.') {
      this.consumeChar();
      values.push(values[values.length - 1] * 2);
    }
    if (this.str.charAt(0) == '&') {
      this.consumeChar();
      if (!/\d/.test(this.str.charAt(0))) {
        throw new Error("Expected number after '&'");
      }
      values.push(...this.consumeLength());
    }
    return values;
  }
  done() {
    return this.str.length === 0;
  }
}

function parseNotes(str) {
  const tok = new PlayTokenizer(str);
  const eng = new PlayEngine();

  while (!tok.done()) {
    let cmd = tok.consumeChar();
    switch(cmd) {
      case 'T':
        eng.setTempo(tok.consumeNumber());
        break;
      case 'V':
        eng.setVolume(tok.consumeNumber());
        break;
      case 'O':
        eng.setOctave(tok.consumeNumber());
        break;
      case 'L':
        eng.setLength(tok.consumeNumber());
        break;
      case '>':
        eng.setOctave(eng.octave + 1);
        break;
      case '<':
        eng.setOctave(eng.octave - 1);
        break;
      case 'A':
      case 'B':
      case 'C':
      case 'D':
      case 'E':
      case 'F':
      case 'G':
        let alter = tok.consumeAlter();
        let length = tok.consumeLength();
        eng.addNote({name: cmd, alter: alter, length: length});
        break;
      case 'R':
        eng.addRest(tok.consumeLength());
        break;
      default:
        throw new Error(`Invalid command: ${cmd}`);
    }
  }
  return eng.notes;
}

const player = new Player();
const piano = new KnightmarePiano();

const btn = document.getElementById('play');
btn.addEventListener('click', ev => {
  play();
});

function play() {
  player.reset();
  channelA = player.channels[0];
  channelB = player.channels[1];
  channelC = player.channels[2];
  addNotes(parseNotes('t225 v11 l8 o5 e r < a > e2&8 c# c# < b a > e e < a > e4. < a4  b4 > c#4 e r e   a4. g4.   d d d e1'), piano, channelA);
  addNotes(parseNotes('t225 v11 l8 o4 a r   e   a2&8 e  e4.        a a   e   a4.   c#4 e4   a4  a r a > e4. c4. < a a a g#1'), piano, channelB);
  addNotes(parseNotes('t225 v12 l8 o2 a4  > e a e a < a4 > e a e a < g4 > e a e a < g4 > e a e a < f4 > c f c f < f4 > c f c f < e1'), piano, channelC);
  player.start();
}