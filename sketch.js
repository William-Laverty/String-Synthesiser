// Developed by William Laverty
// String like synth

let masterVolume = -15;
let initialised = false;
let screenText = "Press the spacebar to enter the sonic realm";

let synths = {};
let wave;
let currentSynth = null;
let sustainPedal = false;

// Sostenuto pedal
let sostenutoPedal = 0; // 0: off, 1: on (hold/sustaining), 2: on (not sustaining new notes)
let sPedalX, sPedalXCenter;
let sPedalToggleCoords;
let sustainedNotes = new Set();

// Modulation pedal
let mPedalX, mPedalXCenter;
let mPedalKnobCoords;
let dragging = false;
let rollover = false;
let angle = 0;

// Pitch Shift pedal
let psPedalX, psPedalXCenter;
let psPedalCoords;
let psPedalSlider;
let stopSlider = false;
let pitchShift;
let playedFreq;
const semitoneRatio = Math.pow(2, 1/12); // 12th root of 2
let minFrequency;
let maxFrequency;

// Ocatve of frequencies for notes C4 
const noteFrequencies = {
  'c4': 261.63, 'c#4': 277.18, 'd4': 293.66, 'd#4': 311.13, 'e4': 329.63,
  'f4': 349.23, 'f#4': 369.99, 'g4': 392.00, 'g#4': 415.30, 'a4': 440.00,
  'a#4': 466.16, 'b4': 493.88, 'c5': 523.25
};

// Synth parameters
let synthParams = {
  detune: 0,
  modDepth: 0,
  chorus: new Tone.Chorus(4, 2.5, 0.5).toDestination(),
  reverb: new Tone.Reverb(1.5).toDestination(),
  tremolo: new Tone.Tremolo(6, 0.8).start().toDestination()
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // waveform
  wave = new Tone.Waveform();
  Tone.Master.connect(wave);
  
  // synth parameters
  Tone.Master.volume.value = masterVolume;

  // sostenuto pedal
  sPedalX = (width/4) * 3;
  sPedalXCenter = sPedalX + 62.5;
  sPedalToggleCoords = [sPedalXCenter, 210];

  // modulation pedal
  mPedalX = ((width/4) * 3) - 150;
  mPedalXCenter = mPedalX + 62.5;
  mPedalKnobCoords = [mPedalXCenter, 210];

  // pitch shift pedal
  psPedalX = ((width/4) * 3) - 300;
  psPedalXCenter = psPedalX + 62.5;
  psPedalCoords = [psPedalXCenter, 210];
  
  // Create for each note
  Object.keys(noteFrequencies).forEach(note => {
    synths[note] = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.8,
        release: 1.5
      },
      modulation: {
        type: "square"
      },
      modulationEnvelope: {
        attack: 0.5,
        decay: 0,
        sustain: 1,
        release: 0.5
      }
    }).chain(synthParams.chorus, synthParams.reverb, synthParams.tremolo).toDestination();
  });
}

function draw() {
  background(0);
  
  if (initialised) {
    drawWaveform(wave);
    displaySynthParams();
    displaySostenuto();
    displayModulation();
    displayPitchShift();
    drawPianoKeys();
  } else {
    fill(255);
    noStroke();
    textSize(20);
    textAlign(CENTER, CENTER);
    text(screenText, width / 2, height / 2);
  }
}

function startStop() {
  if (!initialised) {
    Tone.start();
    initialised = true;
  }
}

// Keyboard interaction (Start)
function keyPressed() {
  if (keyCode === 32) {
    if (!initialised) {
      startStop();
    } else {
      sustainPedal = !sustainPedal;
    }
    return false;
  }
  return false;
}

// Keyboard interaction (Sustain)
function keyReleased() {
  if (keyCode === 32) {
    Object.values(synths).forEach(synth => synth.releaseAll());
  }
  return false;
}

// Mouse interaction
function mousePressed() {
  if (initialised) {
    // Synth Control
    let note = getNoteFromMouse();
    if (note && noteFrequencies.hasOwnProperty(note)) {
      currentSynth = synths[note]; 
      let freq = noteFrequencies[note]; 
      currentSynth.triggerAttack([freq, freq * (1 + synthParams.modDepth / 7500)]); // Modulation

      // Semitone shift calc
      playedFreq = freq;
      minFrequency = playedFreq / semitoneRatio;
      maxFrequency = playedFreq * semitoneRatio;
      
      // Adds note to array to be sustained
      if (sostenutoPedal === 1) {
        sustainedNotes.add(note);
      }
    }

    // Sostenuto Pedal Toggle 
    if (dist(sPedalToggleCoords[0], sPedalToggleCoords[1], mouseX, mouseY) < 25){
      sostenutoPedal = (sostenutoPedal + 1) % 3; 
      // Release all sustained notes if sostenuto pedal is turned off
      if (sostenutoPedal === 0) {
        sustainedNotes.forEach(note => {
          synths[note].releaseAll();
        });
        sustainedNotes.clear();
      }
    }

    // Modulation Pedal Knob 
    if (dist(mouseX, mouseY, mPedalKnobCoords[0], mPedalKnobCoords[1]) < 40) {
      // Angle between mouse and knob
      dragging = true;
      let dx = mouseX - mPedalKnobCoords[0]; 
      let dy = mouseY - mPedalKnobCoords[1];
      offsetAngle = atan2(dy, dx) - angle;
    }
  }
}

function mouseReleased() {
  if (initialised && currentSynth) {
    let note = getNoteFromMouse();

    // Check to sustain played note
    if (!sustainPedal && !sustainedNotes.has(note)) {
      currentSynth.releaseAll();
    }
    currentSynth = null;
  }
  dragging = false;
}

// Returns note that mouse clicked
function getNoteFromMouse() {
  if (mouseY > height - 100) {
    let keyWidth = width / Object.keys(noteFrequencies).length;
    let keyIndex = floor(mouseX / keyWidth);
    let note = Object.keys(noteFrequencies)[keyIndex];
    return note;
  } else {
    return null;
  }
}

// Draw piano keys
function drawPianoKeys() {
  let keyWidth = width / Object.keys(noteFrequencies).length;
  Object.keys(noteFrequencies).forEach((note, index) => {
    if (note.includes('#')) {
      // Draw black keys
      fill(0); 
      rect(index * keyWidth, height - 100, keyWidth, 100);
    } else {
      // Draw white keys
      fill(255); 
      rect(index * keyWidth, height - 100, keyWidth - 5 , 100);
    }
  });
}

// Draw waveform
function drawWaveform(waveform) {
  stroke(255);
  let buffer = waveform.getValue(0);
  
  // Find the first positive value in the buffer
  let start = 0;
  for (let i = 1; i < buffer.length; i++) {
    if (buffer[i - 1] < 0 && buffer[i] >= 0) {
      start = i;
      break;
    }
  }
  
  let end = start + buffer.length / 2;
  
  // Map the waveform
  for (let i = start; i < end; i++) {
    let x1 = map(i - 1, start, end, 0, width);
    let y1 = map(buffer[i - 1], -1, 1, 0, height);
    let x2 = map(i, start, end, 0, width);
    let y2 = map(buffer[i], -1, 1, 0, height);
    line(x1, y1, x2, y2);
  }
}

// Sostenuto Pedal
function displaySostenuto() {
  // Sostenuto pedal box
  fill("gold");
  rect(sPedalX, 20, 125, 250);
  noStroke();

  // Text atributes
  fill(0);
  textAlign(CENTER, CENTER);

  // Sostenuto pedal title
  textSize(16);
  textStyle(BOLD); 
  text('Sostenuto', sPedalXCenter, 50);

  // Sostenuto pedal description
  textSize(10);
  textStyle(NORMAL);  
  text('Holds notes already playing when pressed, but ignores new ones, allowing selective sustain without blurring the sound.', sPedalX + 12.5, 40, 100, 150);

  push();
  translate(sPedalToggleCoords[0], sPedalToggleCoords[1]);

  // Outer circle (knob base)
  if (sostenutoPedal === 1) {
    // Fades recording light in and out
    let t = (sin(frameCount * 0.05) + 1) / 2;
    fill(lerpColor(color("darkred"), color("red"), t));
  } else if (sostenutoPedal === 2) {
    fill("green");
  } else {
    fill(40);
  }
  circle(0, 0, 50);

  // Inner circle (knob face)
  fill(20);
  circle(0, 0, 40);

  // Serrated edge effect
  stroke(60);
  strokeWeight(1);
  for (let i = 0; i < 20; i++) {
    let a = i * TWO_PI / 20;
    line(28 * cos(a), 28 * sin(a), 30 * cos(a), 30 * sin(a));
  }

  pop();
  fill(0);
  noStroke();
}

// Modulation Pedal
function displayModulation() {
  // Modulation pedal box
  fill("skyblue");
  rect(mPedalX, 20, 125, 250);
  noStroke();

  // Text attributes
  fill(0);
  textAlign(CENTER, CENTER);

  // Modulation pedal title
  textSize(16);
  textStyle(BOLD);
  text('Modulation', mPedalXCenter, 50);

  // Modulation pedal description 
  textSize(10);
  textStyle(NORMAL);
  text('Modulates the pitch or amplitude of the notes, creating vibrato or tremolo effects, adding richness and depth to the sound.', mPedalX + 12.5, 40, 100, 150);

  // Modulation pedal movement
  if (dragging) {
    let dx = mouseX - mPedalKnobCoords[0];
    let dy = mouseY - mPedalKnobCoords[1];
    let mouseAngle = atan2(dy, dx);
    angle = mouseAngle - offsetAngle;
    
    // Angle always between 0 and TWO_PI
    angle = (angle + TWO_PI) % TWO_PI;
  }

  push();
  translate(mPedalKnobCoords[0], mPedalKnobCoords[1]);

  // Outer circle (knob base)
  fill(40);
  circle(0, 0, 50);

  // Inner circle (knob face)
  fill(20);
  circle(0, 0, 40);

  // Colored arc
  noFill();
  strokeWeight(5);
  stroke(255, 165, 0); // Orange color
  arc(0, 0, 50, 50, -HALF_PI, -HALF_PI + angle);
  rotate(angle);

  // White indicator line
  stroke(255);
  strokeWeight(2);
  line(0, -25, 0, -15);

  // Serrated edge effect 
  stroke(60);
  strokeWeight(1);
  for (let i = 0; i < 20; i++) {
    let a = i * TWO_PI / 20;
    line(28 * cos(a), 28 * sin(a), 30 * cos(a), 30 * sin(a));
  }
  pop();
  fill(0);

  // Map the angle to a value between 0 and 100
  let value = int(map(angle, 0, TWO_PI, 0, 100));

  // Show mod value under 
  textAlign(CENTER);
  synthParams.modDepth = value;
  text(value, mPedalKnobCoords[0], mPedalKnobCoords[1] + 45); 
}

// Pitch Shift Pedal
function displayPitchShift() {
  // Pitch Shift pedal box
  fill("Plum");
  rect(psPedalX, 20, 125, 250);
  noStroke();

  // Text atributes
  fill(0);
  textAlign(CENTER, CENTER);

  // Pitch Shift pedal title
  textSize(16);
  textStyle(BOLD); 
  text('Pitch Shift', psPedalXCenter, 50);

  // Pitch Shift pedal description
  textSize(10);
  textStyle(NORMAL);  
  text('Transposes notes up or down within ±1hz without changing their duration or tempo.', psPedalX + 12.5, 40, 100, 150);

  if (initialised && !stopSlider) {
    psPedalSlider = createSlider(0, 255, 127, 1);
    psPedalSlider.position(psPedalCoords[0] - (psPedalSlider.width / 3.2), psPedalCoords [1] - (psPedalSlider.height)); // Mess with the position (not centered)
    psPedalSlider.size(80);
    psPedalSlider.style('transform', 'rotate(270deg)');
    return stopSlider = true;
  }

  fill(0);
  textSize(10);
  pitchShift = psPedalSlider.value();
  let freq = map(pitchShift, 0, 255, minFrequency, maxFrequency); // Maps pitch fregquency for slider
  text(floor(freq), psPedalCoords[0], psPedalCoords[1] + 45);
}

// Display synth parameters
function displaySynthParams() {
  fill(255);
  noStroke();
  textSize(16);
  textAlign(LEFT, TOP);
  text(`Detune: ${synthParams.detune}`, 10, 10);
  text(`Mod Depth: ${synthParams.modDepth}`, 10, 30);
  text(`Sustain: ${sustainPedal ? 'ON' : 'OFF (Use spacebar to enable)'}`, 10, 50);
  text(`Sostenuto: ${['OFF (Use pedal to enable)', 'ON (Sustaining)', 'ON (Not sustaining new notes)'][sostenutoPedal]}`, 10, 70);
}
