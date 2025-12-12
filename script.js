// --- 1. Global Game State Variables & Constants ---
let score = 0;
let isGameOver = true;
let currentChallenge = {};
let timeLimit = 1500; 
let highScore = 0;
let isFirstGame = true; 
let gameMode = 'NORMAL'; 
let isNewHighScore = false; 

// Touch variables for swipe detection
let touchstartX = 0;
let touchstartY = 0;
let touchendX = 0;
let touchendY = 0;
const SWIPE_THRESHOLD = 50; 
const BASE_HIGH_SCORE_KEY = 'ColorSwipeMatch_HighScore_'; 

// Mapping: The required swipe direction for each color
const COLOR_TO_DIRECTION = {
    'RED': 'UP',
    'BLUE': 'LEFT',
    'GREEN': 'DOWN',
    'YELLOW': 'RIGHT'
};
const COLORS = Object.keys(COLOR_TO_DIRECTION);


// --- 2. References to HTML Elements ---
const loadingScreen = document.getElementById('loading-screen'); 
const gameContainer = document.getElementById('game-container'); 
const scoreDisplay = document.getElementById('score-display');
const highScoreDisplay = document.getElementById('high-score-display'); 
const timerDisplay = document.getElementById('timer-display');
const promptText = document.getElementById('prompt-text');
const colorBlock = document.getElementById('color-block');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start-button');
const finalScoreElement = document.getElementById('final-score');
const overlayMessage = document.getElementById('overlay-message');
const overlayHighScoreElement = document.getElementById('overlay-high-score'); 
const instructionsContainer = document.getElementById('instructions-container'); 
const instructionsButton = document.getElementById('instructions-button'); 
const closeInstructionsButton = document.getElementById('close-instructions'); 

const normalModeButton = document.getElementById('easy-mode-button'); 
const hardModeButton = document.getElementById('hard-mode-button');
const modeSelectionDiv = document.getElementById('mode-selection');


// --- 3. High Score and Initialization Logic ---

function loadHighScore() {
    const modeKey = BASE_HIGH_SCORE_KEY + gameMode;
    const storedScore = localStorage.getItem(modeKey);
    highScore = storedScore ? parseInt(storedScore) : 0;
    // FIX: Ensure immediate refresh of the display
    updateScoreDisplay();
}

function checkAndSaveHighScore() {
    isNewHighScore = false;
    if (score > highScore) {
        highScore = score;
        const modeKey = BASE_HIGH_SCORE_KEY + gameMode;
        localStorage.setItem(modeKey, highScore.toString());
        isNewHighScore = true; 
        return true;
    }
    return false;
}

function hideLoadingScreen() {
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        gameContainer.style.display = 'flex'; 
        endGame("COLOR SWIPE MATCH"); 
    }, 500); 
}

/**
 * Sets the game mode, updates UI, and loads the corresponding high score (FIXED).
 */
function selectMode(mode) {
    gameMode = mode;
    // Visually indicate which mode is selected
    if (mode === 'HARD') {
        hardModeButton.style.backgroundColor = '#FF4500';
        normalModeButton.style.backgroundColor = '#555';
    } else {
        normalModeButton.style.backgroundColor = '#00ff88';
        hardModeButton.style.backgroundColor = '#555';
    }
    startButton.textContent = `START GAME`;
    
    // Load the high score for the selected mode immediately
    loadHighScore();
    
    // Update the overlay high score display if it's visible
    overlayHighScoreElement.innerHTML = `High Score: <span class="high-score-number">${highScore}</span>`;
}


// --- 4. Core Game Functions ---

function startGame() {
    score = 0;
    isGameOver = false;
    isNewHighScore = false; 
    timeLimit = gameMode === 'HARD' ? 1200 : 1500;
    isFirstGame = false; 
    
    overlay.style.display = 'none';
    promptText.textContent = "SWIPE!";
    colorBlock.style.backgroundColor = '#6a6a6a'; 
    updateScoreDisplay(); 
    
    setTimeout(generateNewChallenge, 500); 
}

function updateScoreDisplay() {
    scoreDisplay.textContent = `Score: ${score}`;
    highScoreDisplay.textContent = `High Score: ${highScore}`; 
    timerDisplay.textContent = `Time: ${(timeLimit / 1000).toFixed(2)}s`;
}

function generateNewChallenge() {
    if (isGameOver) return;
    
    const blockColorIndex = Math.floor(Math.random() * COLORS.length);
    const chosenBlockColor = COLORS[blockColorIndex];

    let chosenTextColor = chosenBlockColor; 
    
    if (gameMode === 'HARD') {
        if (Math.random() < 0.6) { 
            let conflictingColor;
            do {
                const conflictingIndex = Math.floor(Math.random() * COLORS.length);
                conflictingColor = COLORS[conflictingIndex];
            } while (conflictingColor === chosenBlockColor); 
            
            chosenTextColor = conflictingColor; 
        }
    }

    currentChallenge = {
        color: chosenBlockColor,
        requiredDirection: COLOR_TO_DIRECTION[chosenBlockColor]
    };

    promptText.textContent = chosenTextColor; 
    colorBlock.style.backgroundColor = chosenBlockColor.toLowerCase(); 
    
    if (gameMode === 'HARD' && chosenTextColor !== chosenBlockColor) {
        let textDisplayColor;
        do {
            const textIndex = Math.floor(Math.random() * COLORS.length);
            textDisplayColor = COLORS[textIndex];
        } while (textDisplayColor === chosenTextColor);
        
        promptText.style.color = textDisplayColor.toLowerCase();

    } else {
        promptText.style.color = 'white'; 
    }
    
    startTimer();
}

let challengeTimeout;
let countdownInterval;

function startTimer() {
    clearTimeout(challengeTimeout);
    clearInterval(countdownInterval);
    challengeTimeout = setTimeout(() => {
        endGame("TIME UP!");
    }, timeLimit);
    updateTimerDisplayRealtime(); 
}

function updateTimerDisplayRealtime() {
    const startTime = Date.now();
    const endTime = startTime + timeLimit;
    
    countdownInterval = setInterval(() => {
        if (isGameOver) {
            clearInterval(countdownInterval);
            return;
        }
        const remainingTime = endTime - Date.now();
        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            timerDisplay.textContent = `Time: 0.00s`;
            return;
        }
        timerDisplay.textContent = `Time: ${(remainingTime / 1000).toFixed(2)}s`;
    }, 10); 
}

function checkInput(playerDirection) {
    if (isGameOver) { return; }

    clearTimeout(challengeTimeout);
    clearInterval(countdownInterval);

    if (playerDirection === currentChallenge.requiredDirection) {
        score++;
        updateScoreDisplay();
        adjustDifficulty();
        generateNewChallenge();
    } else {
        endGame("TRY AGAIN!"); 
    }
}

function adjustDifficulty() {
    let timeReduction = gameMode === 'HARD' ? 75 : 50; 
    let minTime = gameMode === 'HARD' ? 300 : 500;
    
    if (score > 0 && score % 5 === 0 && timeLimit > minTime) {
        timeLimit -= timeReduction; 
        updateScoreDisplay(); 
    }
}

function endGame(reason) {
    isGameOver = true;
    clearTimeout(challengeTimeout);
    clearInterval(countdownInterval);
    
    checkAndSaveHighScore(); 

    promptText.style.color = 'white'; 

    let message = reason;
    if (reason === "TRY AGAIN!") {
        message = "Incorrect Swipe! Try Again."; 
    } else if (reason === "TIME UP!") {
        message = "Time's Up! Too Slow.";
    }

    // SIMPLIFIED ANNOUNCEMENT
    overlayMessage.textContent = message;
    
    // Final score display with new high score tag (USING CSS CLASS)
    let scoreText = `SCORE: ${score}`;
    if (isNewHighScore) {
        // Use the defined CSS class for styling the tag
        scoreText += ' <span class="new-high-score-tag">✨ NEW HIGH!</span>'; 
    }
    finalScoreElement.innerHTML = scoreText; 
    finalScoreElement.style.display = 'block'; 
    
    // High Score display
    overlayHighScoreElement.innerHTML = `High Score: <span class="high-score-number">${highScore}</span>`; 
    overlayHighScoreElement.style.display = 'block'; 

    startButton.textContent = `START GAME`; 

    modeSelectionDiv.style.display = 'flex';
    overlay.style.display = 'flex'; 
    
    // Load high score again to update the top status bar display
    loadHighScore(); 
}


// --- 5. Input and Initialization ---

// --- Instruction Menu Listeners (unchanged) ---
instructionsButton.addEventListener('click', () => {
    instructionsContainer.style.display = 'flex';
});

closeInstructionsButton.addEventListener('click', () => {
    instructionsContainer.style.display = 'none';
});

// --- Mode Selection Listeners (unchanged) ---
normalModeButton.addEventListener('click', () => selectMode('NORMAL'));
hardModeButton.addEventListener('click', () => selectMode('HARD'));

// Touch listeners (unchanged)
function handleTouchStart(e) { touchstartX = e.changedTouches[0].screenX; touchstartY = e.changedTouches[0].screenY;}
function handleTouchEnd(e) { 
    if (isGameOver) return; 
    touchendX = e.changedTouches[0].screenX; touchendY = e.changedTouches[0].screenY;
    const deltaX = touchendX - touchstartX;
    const deltaY = touchendY - touchstartY;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) { return; }
    let direction = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) { direction = deltaX > 0 ? 'RIGHT' : 'LEFT'; } 
    else { direction = deltaY > 0 ? 'DOWN' : 'UP'; }
    if (direction) { checkInput(direction); }
}

// Keyboard listener (unchanged)
document.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    let direction = null;
    switch(e.key) {
        case 'ArrowUp': case 'w': direction = 'UP'; break;
        case 'ArrowDown': case 's': direction = 'DOWN'; break;
        case 'ArrowLeft': case 'a': direction = 'LEFT'; break;
        case 'ArrowRight': case 'd': direction = 'RIGHT'; break;
    }
    if (direction) { checkInput(direction); }
});


// Initialization sequence
gameContainer.addEventListener('touchstart', handleTouchStart);
gameContainer.addEventListener('touchend', handleTouchEnd);
startButton.addEventListener('click', startGame);

window.onload = () => {
    selectMode('NORMAL');
    hideLoadingScreen(); 
};