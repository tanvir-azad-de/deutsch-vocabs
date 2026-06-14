let vocabData = [];
let currentIndex = 0;
const flashcard = document.getElementById('flashcard');
const wordListEl = document.getElementById('word-list');
const listCounterEl = document.getElementById('list-counter');
const datasetSelectEl = document.getElementById('dataset-select');

const STORAGE_KEY_DATASET = 'deutsch-vocabs-dataset';
const STORAGE_KEY_INDEX = 'deutsch-vocabs-index';

function saveState(datasetFile, index) {
    try {
        localStorage.setItem(STORAGE_KEY_DATASET, datasetFile);
        localStorage.setItem(STORAGE_KEY_INDEX, String(index));
    } catch (error) {
        console.warn('Failed to save state to local storage:', error);
    }
}

function loadState() {
    try {
        const dataset = localStorage.getItem(STORAGE_KEY_DATASET);
        const index = localStorage.getItem(STORAGE_KEY_INDEX);
        return { dataset, index: index ? parseInt(index, 10) : 0 };
    } catch (error) {
        console.warn('Failed to load state from local storage:', error);
        return { dataset: null, index: 0 };
    }
}

function renderWordList() {
    wordListEl.innerHTML = '';

    vocabData.forEach((item, index) => {
        const li = document.createElement('li');
        li.id = `list-item-${index}`;
        li.innerHTML = `
            <div class="list-item-main">
                <span class="list-index">${String(index + 1).padStart(2, '0')}</span>
                <div class="list-word-copy">
                    <span class="list-en-word">${item.englishWord}</span>
                    <span class="list-de-word">${item.englishSentence}</span>
                </div>
            </div>
            <span class="list-chevron">›</span>
        `;
        li.onclick = () => selectCard(index);
        wordListEl.appendChild(li);
    });
}

function buildWordTypeBadges(wordType, germanWord = '') {
    const segments = wordType.split('|').map(segment => segment.trim()).filter(Boolean);

    return segments.map(segment => {
        const nounMatch = segment.match(/^Noun\s*\(([^)]+)\)$/i);
        if (!nounMatch) {
            return `<span class="type-badge">${segment}</span>`;
        }

        const nounDetails = nounMatch[1].toLowerCase();
        const isPlural = /plural/.test(nounDetails) || /plural/i.test(germanWord);

        if (isPlural) {
            return '<span class="type-badge type-badge--plural">die (plural)</span>';
        }

        if (nounDetails.includes('masculine')) {
            return '<span class="type-badge type-badge--masculine">der</span>';
        }

        if (nounDetails.includes('feminine')) {
            return '<span class="type-badge type-badge--feminine">die</span>';
        }

        if (nounDetails.includes('neuter')) {
            return '<span class="type-badge type-badge--neuter">das</span>';
        }

        return `<span class="type-badge">${segment}</span>`;
    }).join('');
}

async function loadDataset(fileName, resumeIndex = 0) {
    try {
        const response = await fetch(fileName);
        if (!response.ok) {
            throw new Error(`Failed to load ${fileName}`);
        }

        vocabData = await response.json();
        currentIndex = Math.min(resumeIndex, vocabData.length - 1);
        renderWordList();
        updateCard();
        saveState(fileName, currentIndex);
    } catch (error) {
        console.error('Error loading vocabulary data:', error);
        document.getElementById('en-word').innerText = 'Error loading data.';
        document.getElementById('en-sentence').innerText = '';
        document.getElementById('de-word').innerText = '';
        document.getElementById('de-sentence').innerText = '';
        document.getElementById('de-type').innerHTML = '';
        listCounterEl.innerText = 'Word List (0/0)';
        wordListEl.innerHTML = '<li class="empty-state">Unable to load this deck.</li>';
    }
}

function populateDatasetDropdown() {
    const datasets = window.availableDatasets || [];

    if (datasets.length === 0) {
        datasetSelectEl.innerHTML = '<option value="">No decks available</option>';
        datasetSelectEl.disabled = true;
        return;
    }

    datasetSelectEl.innerHTML = datasets
        .map(dataset => `<option value="${dataset.file}">${dataset.label}</option>`)
        .join('');

    datasetSelectEl.addEventListener('change', (event) => {
        loadDataset(event.target.value, 0);
    });

    const savedState = loadState();
    const initialDataset = datasets.find(d => d.file === savedState.dataset)?.file || datasets[0].file;
    datasetSelectEl.value = initialDataset;
}

// Fetch the selected JSON file instead of hardcoding it
async function initApp() {
    populateDatasetDropdown();
    const savedState = loadState();
    const datasets = window.availableDatasets || [];
    const initialDataset = datasets.find(d => d.file === savedState.dataset)?.file || datasets[0]?.file;
    if (initialDataset) {
        await loadDataset(initialDataset, savedState.index);
    }
}

function setEmptyCardState() {
    document.getElementById('en-word').innerText = 'No words loaded';
    document.getElementById('en-sentence').innerText = '';
    document.getElementById('de-word').innerText = '';
    document.getElementById('de-sentence').innerText = '';
    document.getElementById('de-type').innerHTML = '';
    listCounterEl.innerText = 'Word List (0/0)';
    wordListEl.innerHTML = '<li class="empty-state">No vocabulary in this deck.</li>';
}

function updateCard() {
    if (vocabData.length === 0) {
        setEmptyCardState();
        return;
    }
    const data = vocabData[currentIndex];
    
    // Front
    document.getElementById('en-word').innerText = data.englishWord;
    document.getElementById('en-sentence').innerText = data.englishSentence;
    
    // Back
    
    // --- UPDATED SECTION FOR MODERN BADGES/TAGS ---
    if (data.wordType) {
        const badgesHtml = `<div class="word-type-container">${buildWordTypeBadges(data.wordType, data.germanWord)}</div>`;
        
        document.getElementById('de-type').innerHTML = badgesHtml;
    } else {
        // Fallback if wordType is missing
        document.getElementById('de-type').innerHTML = ''; 
    }
    // -----------------------------------------

    document.getElementById('de-word').innerText = data.germanWord;
    document.getElementById('de-sentence').innerText = data.germanSentence;

    // Update Counter
    listCounterEl.innerText = `Word List (${currentIndex + 1}/${vocabData.length})`;

    // Update list active state
    document.querySelectorAll('.word-list li').forEach(li => li.classList.remove('active'));
    const activeItem = document.getElementById(`list-item-${currentIndex}`);
    if (activeItem) {
        activeItem.classList.add('active');
        // Scroll into view within the list container smoothly
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Adjust this number if your CSS transition is longer (e.g., 500ms or 600ms)
const FLIP_ANIMATION_DURATION = 400; 

async function changeCard(newIndex) {
    // If the card is flipped, unflip it and wait for the animation to finish
    if (flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');
        
        // Wait slightly longer than or exactly equal to your CSS transition
        await new Promise(resolve => setTimeout(resolve, FLIP_ANIMATION_DURATION));
    }
    
    // Update the index and the card content
    currentIndex = newIndex;
    updateCard();
    saveState(datasetSelectEl.value, currentIndex);
}

function nextCard() {
    const nextIndex = (currentIndex < vocabData.length - 1) ? currentIndex + 1 : 0;
    changeCard(nextIndex);
}

function prevCard() {
    const prevIndex = (currentIndex > 0) ? currentIndex - 1 : vocabData.length - 1;
    changeCard(prevIndex);
}

function selectCard(index) {
    changeCard(index);
}

function flipCard() {
    flashcard.classList.toggle('flipped');
}

// Keyboard Support
document.addEventListener('keydown', (e) => {
    if(e.key === 'ArrowRight') nextCard();
    if(e.key === 'ArrowLeft') prevCard();
    if(e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        flipCard();
    }
});

// Initialize
window.onload = initApp;