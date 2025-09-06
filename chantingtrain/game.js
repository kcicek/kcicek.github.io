// Global game state variables
var chantWords = [];
var wrongKeyCount = 0;
var totalKeyCount = 0;
var currentWordIndex = 0;
var currentLetterIndex = 0;
var trainPosition = 0;
var guidanceOn = true; // global guidance flag
var gameRunning = false; // true when a game round is active
var inputListener = null;
var sceneryOffset = 0;
var sceneryObjects = [];
var carsToShow = 1; // Number of cars/words currently shown
var startTime = null; // timestamp when game started
var trainShift = 0; // px of additional left shift applied to the centered train
var lastCarStep = 68; // measured car step in px (fallback)
var charStep = 18; // per-letter deterministic step in px (measured later)
// Chant Memorizer Game Logic

function renderScenery() {
    var chantDisplay = document.getElementById('chant-display');
    // Draw the animated track
    var track = document.createElement('div');
    track.className = 'chant-track';
    // Animate the track background position to match scenery
    if (!window.trackOffset) window.trackOffset = 0;
    window.trackOffset += 4;
    track.style.backgroundPosition = window.trackOffset + 'px 0';
    chantDisplay.appendChild(track);

    // Animate scenery objects
    var background = document.createElement('div');
    background.className = 'background';
    background.style.left = '0px';


    // Remove objects that moved off screen (right side)
    sceneryObjects = sceneryObjects.filter(obj => obj.x < chantDisplay.offsetWidth + 100);

    // Move all objects right (smaller step for visible animation)
    sceneryObjects.forEach(obj => obj.x += 4);

    // Randomly add new objects on the left
    if (Math.random() < 0.1) {
        var type = Math.random() < 0.5 ? 'tree' : 'house';
        var obj = { type: type, x: -60 };
        sceneryObjects.push(obj);
    }

    // Render all scenery objects
    sceneryObjects.forEach(obj => {
        var el = document.createElement('div');
        el.className = obj.type;
        el.style.left = obj.x + 'px';
        el.style.bottom = '0px';
        if (obj.type === 'tree') {
            el.innerHTML = `
                <svg width="40" height="60" viewBox="0 0 40 60">
                    <rect x="16" y="40" width="8" height="20" fill="#795548" />
                    <ellipse cx="20" cy="32" rx="18" ry="20" fill="#388e3c" />
                </svg>
            `;
        } else {
            el.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 48 48">
                    <rect x="8" y="20" width="32" height="20" fill="#ffb300" stroke="#795548" stroke-width="3" />
                    <polygon points="24,4 4,24 44,24" fill="#d84315" />
                    <rect x="20" y="28" width="8" height="12" fill="#fff" />
                </svg>
            `;
        }
        background.appendChild(el);
    });
    chantDisplay.appendChild(background);

    // Animate scenery every 50ms (only while a game is running)
    if (gameRunning && !window.sceneryInterval) {
        window.sceneryInterval = setInterval(function() {
            renderTrain();
        }, 50);
    }
}

function renderTrain() {
    var chantDisplay = document.getElementById('chant-display');
    chantDisplay.innerHTML = '';
    if (!window.chantCompleted) {
        renderScenery();
    } else {
        // Remove track and scenery after completion
        if (document.querySelector('.chant-track')) {
            document.querySelector('.chant-track').remove();
        }
        if (document.querySelector('.background')) {
            document.querySelector('.background').remove();
        }
    }
    var train = document.createElement('div');
    train.className = 'train';
    // SVG Train Engine
    var engine = document.createElement('div');
        engine.className = 'engine';
        engine.innerHTML = `
            <svg width="60" height="40" viewBox="0 0 60 40" style="transform: scaleX(-1);">
                <rect x="0" y="10" width="40" height="20" rx="6" fill="#333" />
                <rect x="40" y="15" width="15" height="15" rx="4" fill="#666" />
                <circle cx="15" cy="32" r="6" fill="#888" />
                <circle cx="45" cy="32" r="6" fill="#888" />
                <rect x="10" y="0" width="10" height="10" rx="3" fill="#2196f3" />
            </svg>
        `;
    train.appendChild(engine);
        // engine is part of the train; we move the entire train to center the active letter.
    // Cars for each word
    for (var i = 0; i < carsToShow; i++) {
        var car = document.createElement('div');
        car.className = 'car';
        var word = chantWords[i] || '';
        for (var j = 0; j < (word ? word.length : 0); j++) {
            var letterSpan = document.createElement('span');
            letterSpan.className = 'letter';
            // Guidance OFF: only show letters that have been completed (typed correctly)
            // Guidance ON: show all letters normally
            var showLetter = guidanceOn || (i < currentWordIndex) || (i === currentWordIndex && j < currentLetterIndex);
            letterSpan.textContent = showLetter ? word[j] : '';
            // Highlighting logic: show 'correct' for completed letters always; show 'current' only when guidance is ON
            if (i < currentWordIndex) {
                letterSpan.classList.add('correct');
            } else if (i === currentWordIndex && j < currentLetterIndex) {
                letterSpan.classList.add('correct');
            } else if (guidanceOn && i === currentWordIndex && j === currentLetterIndex) {
                letterSpan.classList.add('current');
            }
            car.appendChild(letterSpan);
        }
        train.appendChild(car);
    }
    // Measure a car width (approx) for spacing calculations
    var firstCar = train.querySelector('.car');
    if (firstCar) {
        var rect = firstCar.getBoundingClientRect();
        // include margin-right (~8px) to get sensible spacing
        lastCarStep = Math.round(rect.width + 8);
    }
    // Measure a representative letter width to use as the per-letter step
    var sampleLetter = train.querySelector('.letter');
    if (sampleLetter) {
        try {
            var lrect = sampleLetter.getBoundingClientRect();
            charStep = Math.max(8, Math.round(lrect.width + 8));
        } catch (e) {}
    }
    chantDisplay.appendChild(train);

        // Apply the last computed trainShift (set on correct input) so the train doesn't re-measure every frame.
        train.style.transform = 'translateX(' + (-trainShift) + 'px)';

        // Fade earlier cars so the focused/current word stands out
        try {
            var carEls = train.querySelectorAll('.car');
            for (var k = 0; k < carEls.length; k++) {
                if (k < currentWordIndex - 1) {
                    carEls[k].classList.add('faded');
                } else {
                    carEls[k].classList.remove('faded');
                }
            }
        } catch (err) {
            // ignore
        }
}
    // (Removed measurement-based centering; using deterministic per-letter steps instead.)

function startGame() {
    var chantInput = document.getElementById('user-input');
    chantWords = chantInput.value.trim().split(/\s+/);
    if (chantWords.length === 0 || chantWords[0] === '') {
        showMessage('Please enter a chant or phrase.');
        return;
    }
    currentWordIndex = 0;
    currentLetterIndex = 0;
    trainPosition = 0;
    sceneryOffset = 0;
    sceneryObjects = [];
    carsToShow = 1;
    chantInput.value = '';
    chantInput.disabled = true;
    chantInput.style.display = 'none';
    document.getElementById('submit-button').style.display = 'none';
    wrongKeyCount = 0;
    totalKeyCount = 0;
    startTime = Date.now();
    gameRunning = true;
    renderTrain();
    // Hide score display during gameplay (show only at end)
    var scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.style.display = 'none';
    // Hide chant buttons bar
    var chantButtons = document.getElementById('chant-buttons');
    if (chantButtons) chantButtons.style.display = 'none';
    // One-time initial centering: nudge so the first active letter starts near center
    setTimeout(function() { adjustForActiveLetter(); }, 30);
    // Skip any punctuation or non-English letters at the start
    setTimeout(function() { advanceSkippables(); }, 40);
    if (inputListener) {
        document.removeEventListener('keydown', inputListener);
    }
    inputListener = handleInput;
    document.addEventListener('keydown', inputListener);
    showMessage('Start typing the first word!');
}

// Measure active letter position and increase trainShift so it reaches container center.
function adjustForActiveLetter() {
    try {
        var chantDisplay = document.getElementById('chant-display');
        var train = chantDisplay.querySelector('.train');
        if (!train) return;
        var carEls = train.querySelectorAll('.car');
        if (!carEls || carEls.length === 0) return;
        var currentCar = carEls[Math.min(currentWordIndex, carEls.length - 1)];
        var letterEls = currentCar.querySelectorAll('.letter');
        var letterEl = letterEls && letterEls.length ? letterEls[Math.min(currentLetterIndex, letterEls.length - 1)] : null;
        var containerRect = chantDisplay.getBoundingClientRect();
        var containerWidth = containerRect.width;
        var containerCenterX = containerRect.left + containerWidth / 2;
        var targetCenterX;
        if (letterEl) {
            var lr = letterEl.getBoundingClientRect();
            targetCenterX = lr.left + lr.width / 2;
        } else {
            var cr = currentCar.getBoundingClientRect();
            targetCenterX = cr.left + cr.width / 2;
        }
        var gap = targetCenterX - containerCenterX;

        // Calculate the desired shift to center the active letter
        var desiredShift = trainShift + gap;

        // Strictly clamp so the highlighted letter is always fully visible
        if (letterEl) {
            var letterRect = letterEl.getBoundingClientRect();
            var letterWidth = letterRect.width;
            // Calculate the left and right bounds for the letter inside the container
            var letterLeftInContainer = letterRect.left - containerRect.left;
            var letterRightInContainer = letterRect.right - containerRect.left;
            // If the letter would go out of the left edge, shift more right
            if (letterLeftInContainer < 0) {
                desiredShift -= letterLeftInContainer;
            }
            // If the letter would go out of the right edge, shift more left
            if (letterRightInContainer > containerWidth) {
                desiredShift -= (letterRightInContainer - containerWidth);
            }
        }

        // Smoothly animate to the new shift
        trainShift = desiredShift;
        var trainEl = chantDisplay.querySelector('.train');
        if (trainEl) trainEl.style.transform = 'translateX(' + (-trainShift) + 'px)';
    } catch (e) {
        // ignore measurement errors
    }
}

function handleInput(e) {
    // Only process key presses for letters
    if (!e.key || e.key.length !== 1) return;
    totalKeyCount++;
    // Ensure we are positioned at an alphabetic char (skip punctuation etc.)
    advanceSkippables();
    var currentWord = chantWords[currentWordIndex];
    var expectedLetter = currentWord[currentLetterIndex];
    if (!expectedLetter) return;
    // Compare case-insensitively for letters
    var typed = e.key.toLowerCase();
    var expected = expectedLetter.toLowerCase();
    if (typed === expected) {
        playClickSound();
        currentLetterIndex++;
        // Move forward a fixed per-letter step so the active letter progresses toward center
        trainShift += charStep;
        renderTrain();
        if (currentLetterIndex === currentWord.length) {
            currentWordIndex++;
            currentLetterIndex = 0;
            // Add next car if available, but don't exceed total words
            carsToShow = Math.min(carsToShow + 1, chantWords.length);
            // After adding the car, render and then adjust so the next word's first letter is centered
            renderTrain();
            setTimeout(function() { adjustForActiveLetter(); }, 10);
            // After word completion, also auto-skip any punctuation at start of next word
            setTimeout(function() { advanceSkippables(); }, 20);
            if (currentWordIndex === chantWords.length) {
                window.chantCompleted = true;
                var elapsed = Date.now() - startTime;
                var seconds = Math.floor(elapsed / 1000);
                showMessage('🎉 Congratulations! You completed the chant! 🎉');
                // Show stats at end only: display accuracy (percentage correct)
                var accuracy = totalKeyCount > 0 ? Math.round(((totalKeyCount - wrongKeyCount) / totalKeyCount) * 100) : 0;
                var scoreEl = document.getElementById('score-display');
                if (scoreEl) {
                    scoreEl.innerHTML = '<b>Time:</b> ' + seconds + 's &nbsp; <b>Accuracy:</b> ' + accuracy + '%';
                    scoreEl.style.display = '';
                }
                if (window.sceneryInterval) {
                    clearInterval(window.sceneryInterval);
                    window.sceneryInterval = null;
                }
                gameRunning = false;
                document.removeEventListener('keydown', inputListener);
                    renderTrain(); // re-render train above cleared track/scenery
                    // start final pass: move train out, then return slowly from right with sound
                    setTimeout(runFinalPassSequence, 60);
                return;
            } else {
                showMessage('Great! Now type the next word.');
            }
        } else {
            // On each correct letter (but not word completion), adjust so the active letter stays centered
            setTimeout(function() { adjustForActiveLetter(); }, 6);
        }
    } else {
        playBuzzerSound();
        wrongKeyCount++;
    }
// Play a short click sound for correct letter
function playClickSound() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.value = 0.18;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(function() {
            osc.stop();
            ctx.close();
        }, 60);
    } catch (e) {}
}

// Play a short buzzer sound for incorrect letter
function playBuzzerSound() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 180;
        gain.gain.value = 0.22;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(function() {
            osc.stop();
            ctx.close();
        }, 180);
    } catch (e) {}
}
}

// Utility: return true if character is ASCII English letter A-Z or a-z
function isEnglishLetter(ch) {
    return typeof ch === 'string' && /^[A-Za-z]$/.test(ch);
}

// Advance currentLetterIndex/currentWordIndex over any characters that are not English letters
// (punctuation, numbers, non-Latin letters). Marks carsToShow if words are auto-completed.
function advanceSkippables() {
    if (!chantWords || chantWords.length === 0) return;
    var progressed = false;
    while (currentWordIndex < chantWords.length) {
        var w = chantWords[currentWordIndex] || '';
        // If current letter beyond word length, treat as completion
        if (currentLetterIndex >= w.length) {
            currentWordIndex++;
            currentLetterIndex = 0;
            carsToShow = Math.min(carsToShow + 1, chantWords.length);
            progressed = true;
            continue;
        }
        var ch = w[currentLetterIndex];
        if (isEnglishLetter(ch)) {
            break; // stop at first English letter
        }
        // skip this character
        currentLetterIndex++;
        progressed = true;
    }
    if (progressed) renderTrain();
}

function showMessage(msg) {
    var messageDisplay = document.getElementById('message-display');
    messageDisplay.textContent = msg;
}

// Play a short train horn and animate the whole train passing slowly across the display
function startEndSequence() {
    try {
        var chantDisplay = document.getElementById('chant-display');
        var originalTrain = chantDisplay.querySelector('.train');
        if (!originalTrain) return;

        // Create a clone to animate across the screen
        var clone = originalTrain.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.left = '-100%';
        clone.style.top = originalTrain.style.top || '48px';
        clone.style.transform = 'translateX(0)';
        clone.style.transition = 'transform 6s linear';
        clone.classList.add('end-run');
        chantDisplay.appendChild(clone);

        // Play a simple train horn using WebAudio
        try {
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            var ctx = new AudioContext();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 220;
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            // ramp up and down
            gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            setTimeout(function() { try { osc.stop(); ctx.close(); } catch (e) {} }, 1400);
        } catch (e) {
            // ignore audio errors
        }

        // Start moving after a small delay
        setTimeout(function() {
            // move clone from left off-screen to right off-screen
            clone.style.transform = 'translateX(220%)';
            // remove clone after animation
            setTimeout(function() { try { clone.remove(); } catch (e) {} }, 6500);
        }, 120);
    } catch (e) {
        // ignore
    }
}

// New final pass: 1) quick move the current train off to the right; 2) position it off-screen right and slowly move left across screen with sound
function runFinalPassSequence() {
    try {
        var chantDisplay = document.getElementById('chant-display');
        var train = chantDisplay.querySelector('.train');
        if (!train) return;

        // Highlight all letters for the final exposure
        try {
            var allLetters = chantDisplay.querySelectorAll('.letter');
            allLetters.forEach(function(l) { l.classList.add('correct'); });
        } catch (e) {}

        // Phase 1: quick exit to the right (fast)
        train.style.transition = 'transform 800ms ease-in';
        // move far right by adding large shift
        train.style.transform = 'translateX(-' + (trainShift - (chantDisplay.offsetWidth + 200)) + 'px)';

        // After quick exit, prepare slow return
        setTimeout(function() {
            // Reset visual: place train off-screen right
            train.style.transition = 'none';
            // Position train to the right outside viewport
            train.style.transform = 'translateX(' + (chantDisplay.offsetWidth + 200) + 'px)';

            // Force reflow then start slow leftward motion
            // Before the slow pass, ensure all letters are highlighted and cars are not faded
            try {
                var carEls = train.querySelectorAll('.car');
                carEls.forEach(function(c) { c.classList.remove('faded'); });
                var allLetters = train.querySelectorAll('.letter');
                allLetters.forEach(function(l) { l.classList.add('correct'); });
            } catch (e) {}

            void train.offsetWidth;
            train.style.transition = 'transform 9000ms linear';
            // Move left until fully off-screen left
            train.style.transform = 'translateX(-' + (chantDisplay.offsetWidth + train.offsetWidth + 300) + 'px)';

            // Play steam-engine-like sound during the slow motion
            playTrainPassSound(9000);

            // Cleanup after the pass completes
            setTimeout(function() {
                try { train.remove(); } catch (e) {}
                showEndMenu();
            }, 9200);
// Show end-of-game menu with replay/home options
function showEndMenu() {
    var menu = document.getElementById('end-menu');
    if (!menu) return;
    menu.style.display = 'block';
    var replayBtn = document.getElementById('replay-btn');
    var homeBtn = document.getElementById('home-btn');
    // Remove any previous listeners
    replayBtn.onclick = null;
    homeBtn.onclick = null;
    // Replay: restart with same chant
    replayBtn.onclick = function() {
        menu.style.display = 'none';
        // Reset state and start game with same chantWords
        currentWordIndex = 0;
        currentLetterIndex = 0;
        trainPosition = 0;
        sceneryOffset = 0;
        sceneryObjects = [];
        carsToShow = 1;
        trainShift = 0;
        window.chantCompleted = false;
    // Reset stats and start time for the replay so elapsed time is correct
    wrongKeyCount = 0;
    totalKeyCount = 0;
    startTime = Date.now();
    gameRunning = true;
        renderTrain();
        setTimeout(function() { adjustForActiveLetter(); }, 30);
        setTimeout(function() { advanceSkippables(); }, 40);
        if (inputListener) document.removeEventListener('keydown', inputListener);
        inputListener = handleInput;
        document.addEventListener('keydown', inputListener);
        showMessage('Start typing the first word!');
    };
    // Home: reset to chant entry
    homeBtn.onclick = function() {
    menu.style.display = 'none';
    // Reset all state and show chant entry UI
    currentWordIndex = 0;
    currentLetterIndex = 0;
    trainPosition = 0;
    sceneryOffset = 0;
    sceneryObjects = [];
    carsToShow = 1;
    trainShift = 0;
    window.chantCompleted = false;
    startTime = null;
    var chantInput = document.getElementById('user-input');
    chantInput.disabled = false;
    chantInput.style.display = '';
    document.getElementById('submit-button').style.display = '';
    var chantButtons = document.getElementById('chant-buttons');
    if (chantButtons) chantButtons.style.display = '';
        document.getElementById('score-display').textContent = 'Time: 0s';
        wrongKeyCount = 0;
        totalKeyCount = 0;
    document.getElementById('chant-display').innerHTML = '';
    // stop scenery
    if (window.sceneryInterval) { clearInterval(window.sceneryInterval); window.sceneryInterval = null; }
    gameRunning = false;
    showMessage('Enter a chant or select a button to begin.');
    };
}
        }, 900);
    } catch (e) {
        // ignore
    }
}

// Play a longer train sound during the slow pass. duration in ms.
function playTrainPassSound(duration) {
    try {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        var ctx = new AudioContext();
        var master = ctx.createGain();
        master.connect(ctx.destination);
        master.gain.value = 0.7;

        // Low rumble (continuous)
        var rumbleOsc = ctx.createOscillator();
        rumbleOsc.type = 'triangle';
        rumbleOsc.frequency.value = 60;
        var rumbleGain = ctx.createGain();
        rumbleGain.gain.value = 0.15;
        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(master);

        // Chuff pulses (periodic per-second bursts)
        var chuffOsc = ctx.createOscillator();
        chuffOsc.type = 'square';
        chuffOsc.frequency.value = 100;
        var chuffGain = ctx.createGain();
        chuffGain.gain.value = 0;
        chuffOsc.connect(chuffGain);
        chuffGain.connect(master);

        // Whistle near the beginning
        var whistle = ctx.createOscillator();
        whistle.type = 'sine';
        whistle.frequency.value = 800;
        var whistleGain = ctx.createGain();
        whistleGain.gain.value = 0;
        whistle.connect(whistleGain);
        whistleGain.connect(master);

        rumbleOsc.start();
        chuffOsc.start();
        whistle.start();

        var now = ctx.currentTime;
        // Whistle quick blast
        whistleGain.gain.setValueAtTime(0, now);
        whistleGain.gain.linearRampToValueAtTime(0.8, now + 0.02);
        whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        // Schedule chuff pulses: a chuff every ~0.6s decaying slowly
        var pulseInterval = 600; // ms
        var pulses = Math.max(6, Math.floor(duration / pulseInterval));
        for (var p = 0; p < pulses; p++) {
            (function(i) {
                var t = now + (i * pulseInterval) / 1000;
                chuffGain.gain.setValueAtTime(0.0, t);
                chuffGain.gain.linearRampToValueAtTime(0.6, t + 0.01);
                chuffGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            })(p);
        }

        // Stop after duration
        setTimeout(function() {
            try {
                rumbleOsc.stop();
                chuffOsc.stop();
                whistle.stop();
                ctx.close();
            } catch (e) {}
        }, duration + 300);
    } catch (e) {
        // ignore audio errors
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var submitBtn = document.getElementById('submit-button');
    submitBtn.addEventListener('click', startGame);
    // Chant button bar logic
    var chantButtons = document.getElementById('chant-buttons');
    if (chantButtons) {
        chantButtons.addEventListener('click', function(e) {
            var btn = e.target.closest('.chant-btn');
            if (btn && btn.dataset.chant) {
                var textarea = document.getElementById('user-input');
                textarea.value = btn.dataset.chant;
                textarea.focus();
            }
        });
    }
        // Wire guidance switch (placed next to submit button)
        var guidanceSwitch = document.getElementById('guidance-switch');
        if (guidanceSwitch) {
            guidanceOn = guidanceSwitch.checked;
            guidanceSwitch.addEventListener('change', function() {
                guidanceOn = guidanceSwitch.checked;
                // Only re-render train when a game round is active. Toggling guidance outside
                // of a running game should not display the train.
                if (gameRunning) renderTrain();
            });
        }
});
