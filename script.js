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

// Leaderboard elements
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardContainer = document.getElementById('leaderboard-container');
const leaderboardTitle = document.getElementById('leaderboard-title');
const viewLeaderboardButton = document.getElementById('view-leaderboard-button');
const closeLeaderboardButton = document.getElementById('close-leaderboard');

// Username modal elements
const usernameModal = document.getElementById('username-modal');
const usernameInput = document.getElementById('username-input');
const editNameButton = document.getElementById('edit-name-button');
const closeUsernameModal = document.getElementById('close-username-modal');
const saveUsernameButton = document.getElementById('save-username-button');

// Supabase config
const SUPABASE_URL = 'https://jhzsyzeiojuahoeqptvj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoenN5emVpb2p1YWhvZXFwdHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjY1NjcsImV4cCI6MjA4MDk0MjU2N30.4bUWDsZYo-pT4_K5uiby6q12RmtY1prSwHG54GknC-4';
const SUPABASE_TABLE = 'scores';

// Username storage key
const USERNAME_KEY = 'ColorSwipe_Username';
let currentUsername = null;

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
        overlayMessage.textContent = '';
    }, 500); 
}

/**
 * Sets the game mode, updates UI, and loads the corresponding high score (FIXED).
 */
function selectMode(mode) {
    gameMode = mode;
    // Visually indicate which mode is selected
    normalModeButton.classList.remove('active-normal', 'active-hard');
    hardModeButton.classList.remove('active-normal', 'active-hard');
    if (mode === 'HARD') {
        hardModeButton.classList.add('active-hard');
    } else {
        normalModeButton.classList.add('active-normal');
    }
    startButton.textContent = `START GAME`;
    
    // Load the high score for the selected mode immediately
    loadHighScore();
    
    // Update the overlay high score display if it's visible
    overlayHighScoreElement.textContent = `${highScore}`;
}

// --- 3b. Leaderboard Functions ---

function loadUsername() {
    // Load username from localStorage if it exists
    currentUsername = localStorage.getItem(USERNAME_KEY);
    
    if (currentUsername) {
        usernameInput.value = currentUsername;
    }
}

function saveUsername() {
    const username = usernameInput.value.trim().substring(0, 12);
    
    if (username.length > 0) {
        currentUsername = username;
        localStorage.setItem(USERNAME_KEY, currentUsername);
    } else {
        currentUsername = 'Anonymous';
    }
    
    return currentUsername;
}

async function isUsernameTaken(newUsername) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?username=eq.${encodeURIComponent(newUsername)}&select=username`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error checking username:', response.status, response.statusText);
            return false;
        }
        
        const data = await response.json();
        
        // Check if any rows exist with this username
        // data will be an array, if length > 0 then username exists
        return Array.isArray(data) && data.length > 0;
    } catch (error) {
        console.error('Failed to check username availability:', error);
        return false;
    }
}

async function updateAllPastUserScores(oldUsername, newUsername) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?username=eq.${encodeURIComponent(oldUsername)}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    username: newUsername
                })
            }
        );
        
        if (!response.ok) {
            console.error('Error updating past scores:', response.status, response.statusText);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Failed to update past scores:', error);
        return false;
    }
}

async function handleNameChange() {
    // Retrieve the old username from localStorage
    const oldUsername = localStorage.getItem(USERNAME_KEY);
    
    // Get the new username from the input field
    const newUsername = usernameInput.value.trim().substring(0, 12);
    
    // Validate the new username
    if (!newUsername || newUsername.length === 0) {
        alert('Please enter a valid name.');
        return;
    }
    
    // Check if the name is actually different
    if (newUsername === oldUsername) {
        // Name hasn't changed, just close the modal
        hideUsernameModal();
        return;
    }
    
    // Check if the username is already taken
    const isTaken = await isUsernameTaken(newUsername);
    
    if (isTaken) {
        alert('That name is already in use. Please choose another name.');
        return;
    }
    
    // Update localStorage with the new name
    currentUsername = newUsername;
    localStorage.setItem(USERNAME_KEY, currentUsername);
    
    // Update all past scores in the database if there was an old username
    if (oldUsername && oldUsername !== 'Anonymous' && oldUsername.length > 0) {
        await updateAllPastUserScores(oldUsername, newUsername);
    }
    
    // Close the modal
    hideUsernameModal();
}

function getUsernameForSubmission() {
    // Get current value from input
    const username = usernameInput.value.trim().substring(0, 12);
    return username.length > 0 ? username : 'Anonymous';
}

async function migrateOldScores() {
    try {
        // Find all scores without a username that also have an id
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?username=is.null&id=!is.null&select=id`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        
        if (!response.ok) {
            console.error('Error fetching old scores:', response.status, response.statusText);
            return;
        }
        
        const oldScores = await response.json();
        
        if (!Array.isArray(oldScores) || oldScores.length === 0) {
            console.log('No old scores to migrate');
            return; // No old scores to migrate
        }
        
        console.log('Found ' + oldScores.length + ' old scores to migrate');
        
        // Update all old scores with valid ids to have a default username
        const updateResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?username=is.null&id=!is.null`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    username: 'Player'
                })
            }
        );
        
        if (updateResponse.ok) {
            console.log('Successfully migrated old scores');
        } else {
            console.error('Error updating old scores:', updateResponse.status, updateResponse.statusText);
        }
    } catch (error) {
        console.error('Error migrating old scores:', error);
    }
}

async function submitScoreToLeaderboard(username, score, mode) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                username: username,
                score: score,
                mode: mode
            })
        });
        
        if (!response.ok) {
            console.error('Error submitting score:', response.status, response.statusText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to submit score to leaderboard:', error);
        return false;
    }
}async function fetchAndDisplayLeaderboard() {
    try {
        const query = `order=score.desc&mode=eq.${gameMode}&limit=10`;
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?${query}`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        
        if (!response.ok) {
            leaderboardContainer.innerHTML = `<p class="leaderboard-error">Failed to load leaderboard (${response.status})</p>`;
            return;
        }
        
        const scores = await response.json();
        
        if (!Array.isArray(scores) || scores.length === 0) {
            leaderboardContainer.innerHTML = '<p class="leaderboard-empty">No scores yet. Be the first!</p>';
            return;
        }
        
        // Build leaderboard table
        let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead><tbody>';
        
        scores.forEach((entry, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank} top-3` : '';
            // Use the username from the database - all scores should have one now
            const username = entry.username || 'Player';
            const scoreValue = entry.score || 0;
            
            html += `
                <tr>
                    <td class="leaderboard-rank ${rankClass}">${rank}</td>
                    <td class="leaderboard-username">${escapeHtml(username)}</td>
                    <td class="leaderboard-score">${scoreValue}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        leaderboardContainer.innerHTML = html;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        leaderboardContainer.innerHTML = '<p class="leaderboard-error">Error loading leaderboard</p>';
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showLeaderboard() {
    leaderboardModal.classList.add('show');
    const modeLabel = gameMode === 'HARD' ? 'Hard Mode' : 'Normal Mode';
    leaderboardTitle.textContent = modeLabel;
    // Always fetch fresh data when opening the leaderboard
    fetchAndDisplayLeaderboard();
}

function hideLeaderboard() {
    leaderboardModal.classList.remove('show');
}

function showUsernameModal() {
    usernameModal.classList.add('show');
    usernameInput.value = currentUsername || '';
    usernameInput.focus();
}

function hideUsernameModal() {
    usernameModal.classList.remove('show');
}

// --- 4. Core Game Functions ---

function startGame() {
    score = 0;
    isGameOver = false;
    isNewHighScore = false; 
    timeLimit = gameMode === 'HARD' ? 1200 : 1500;
    isFirstGame = false; 
    
    overlay.style.display = 'none';
    overlayMessage.textContent = '';
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
        
        // Add enlarge animation to color block
        colorBlock.classList.remove('enlarge');
        void colorBlock.offsetWidth; // Trigger reflow to restart animation
        colorBlock.classList.add('enlarge');
        
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
    } else if (reason === "COLOR SWIPE MATCH") {
        message = '';
    }

    // SIMPLIFIED ANNOUNCEMENT
    overlayMessage.textContent = message;
    overlayMessage.style.display = 'block';
    
    // Final score display with new high score tag (USING CSS CLASS)
    let scoreText = `SCORE: ${score}`;
    if (isNewHighScore) {
        // Use the defined CSS class for styling the tag
        scoreText += ' <span class="new-high-score-tag">✨ NEW HIGH!</span>'; 
    }
    finalScoreElement.innerHTML = scoreText; 
    finalScoreElement.style.display = 'block'; 
    
    // High Score display
    overlayHighScoreElement.textContent = `${highScore}`; 
    overlayHighScoreElement.style.display = 'block'; 

    startButton.textContent = `START GAME`; 

    modeSelectionDiv.style.display = 'flex';
    overlay.style.display = 'flex'; 
    
    // Load high score again to update the top status bar display
    loadHighScore(); 
    
    // Submit score to leaderboard if score > 0
    if (score > 0) {
        const username = getUsernameForSubmission();
        submitScoreToLeaderboard(username, score, gameMode);
    }
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

// --- Leaderboard Listeners ---
viewLeaderboardButton.addEventListener('click', () => showLeaderboard());
closeLeaderboardButton.addEventListener('click', () => hideLeaderboard());
leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) {
        hideLeaderboard();
    }
});

// --- Username Modal Listeners ---
editNameButton.addEventListener('click', () => showUsernameModal());
closeUsernameModal.addEventListener('click', () => hideUsernameModal());
saveUsernameButton.addEventListener('click', () => {
    handleNameChange();
});
usernameModal.addEventListener('click', (e) => {
    if (e.target === usernameModal) {
        hideUsernameModal();
    }
});
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleNameChange();
    }
});

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

window.onload = async () => {
    selectMode('NORMAL');
    loadUsername();
    await migrateOldScores(); 
    hideLoadingScreen(); 
};