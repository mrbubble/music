const ctx = new AudioContext();

const btn = document.getElementById('play');
btn.addEventListener('click', ev => {
  play();
});

function play() {
  player = new Player();
  channelA = player.createChannel();
  channelB = player.createChannel();
  channelC = player.createChannel();
  piano = new KnightmarePiano();
  eng = new PlayEngine();
  eng.setTempo(225);
  eng.setOctave(5);
  eng.setLength(8);
  eng.setVolume(11);
  eng.addNote({name: 'E'});
  eng.addRest();
  eng.setOctave(4);
  eng.addNote({name: 'A'});
  eng.setOctave(5);
  eng.addNote({name: 'E', length: [2, 8]});
  console.log(eng.notes);
  addNotes(eng.notes, piano, channelA);

//  piano.playNoteAt(channelA, new Note({name: "E", octave: 5, volume: 11, durationTicks: 8}), 0);
//  piano.playNoteAt(channelA, new Note({name: "A", octave: 4, volume: 11, durationTicks: 8}), 16);
//  piano.playNoteAt(channelA, new Note({name: "E", octave: 5, volume: 11, durationTicks: 40}), 24);
  piano.playNoteAt(channelB, new Note({name: "A", octave: 4, volume: 11, durationTicks: 8}), 0);
  piano.playNoteAt(channelB, new Note({name: "E", octave: 4, volume: 11, durationTicks: 8}), 16);
  piano.playNoteAt(channelB, new Note({name: "A", octave: 4, volume: 11, durationTicks: 40}), 24);
  piano.playNoteAt(channelC, new Note({name: "A", octave: 2, volume: 12, durationTicks: 16}), 0);
  piano.playNoteAt(channelC, new Note({name: "E", octave: 3, volume: 12, durationTicks: 8}), 16);
  piano.playNoteAt(channelC, new Note({name: "A", octave: 3, volume: 12, durationTicks: 8}), 24);
  piano.playNoteAt(channelC, new Note({name: "E", octave: 3, volume: 12, durationTicks: 8}), 32);
  piano.playNoteAt(channelC, new Note({name: "A", octave: 3, volume: 12, durationTicks: 8}), 40);
  player.start();
}

function addNotes(notes, instrument, channel) {
  let pos = 0;
  for (note of notes) {
    instrument.playNoteAt(channel, note, pos);
    pos += note.durationTicks;
  }
}


class Player {
  constructor() {
    this.ctx = new AudioContext();
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