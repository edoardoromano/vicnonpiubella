const URL = './zoologia_questions_topics_2000.json';

// STATE
let rawData = null; 
let selectedTopics = new Set();
let currentExam = []; // The chosen 20 questions
let answers = new Map(); // question_id -> option_index
let isSubmitted = false;

// DOM ELEMENTS
const viewSetup = document.getElementById('view-setup');
const viewExam = document.getElementById('view-exam');
const elTopicList = document.getElementById('topic-list');
const btnStart = document.getElementById('btnStartQuiz');
const btnSelectAll = document.getElementById('btnSelectAll');
const elQuiz = document.getElementById('quiz');
const elGrid = document.getElementById('qGrid');
const elStatus = document.getElementById('statusText');
const btnSubmit = document.getElementById('btnSubmit');
const elDashboard = document.getElementById('result-dashboard');

// --- INIT & SETUP PHASE ---

async function init() {
  try {
    const r = await fetch(URL);
    rawData = await r.json();
    renderTopics();
  } catch (e) {
    alert("Errore caricamento JSON: " + e.message);
  }
}

function renderTopics() {
  elTopicList.innerHTML = '';
  
  rawData.topics.forEach(t => {
    // Create Card
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <span>${t.label}</span>
      <input type="checkbox" class="topic-checkbox" value="${t.id}">
    `;
    
    // Toggle Logic
    card.addEventListener('click', () => {
      const checkbox = card.querySelector('input');
      const id = t.id;
      
      if (selectedTopics.has(id)) {
        selectedTopics.delete(id);
        card.classList.remove('selected');
        checkbox.checked = false;
      } else {
        selectedTopics.add(id);
        card.classList.add('selected');
        checkbox.checked = true;
      }
      updateStartButton();
    });
    
    elTopicList.appendChild(card);
  });
}

function updateStartButton() {
  const count = selectedTopics.size;
  btnStart.disabled = count === 0;
  
  // Calculate potential question pool size for fun
  let poolSize = 0;
  if (rawData && rawData.questions) {
     poolSize = rawData.questions.filter(q => selectedTopics.has(q.topic)).length;
  }
  
  btnStart.textContent = count === 0 
    ? 'Seleziona almeno un argomento' 
    : `Inizia Simulazione (${poolSize} dom. disponibili)`;
}

btnSelectAll.addEventListener('click', () => {
  const cards = document.querySelectorAll('.topic-card');
  const allSelected = selectedTopics.size === rawData.topics.length;

  cards.forEach(card => {
    const checkbox = card.querySelector('input');
    const id = checkbox.value;
    
    if (allSelected) {
      // Deselect all
      selectedTopics.delete(id);
      card.classList.remove('selected');
      checkbox.checked = false;
    } else {
      // Select all
      selectedTopics.add(id);
      card.classList.add('selected');
      checkbox.checked = true;
    }
  });
  updateStartButton();
  btnSelectAll.textContent = allSelected ? "Seleziona Tutti" : "Deseleziona Tutti";
});

btnStart.addEventListener('click', startExam);

// --- EXAM PHASE LOGIC ---

function startExam() {
  // 1. Filter Questions
  const bank = rawData.questions.filter(q => selectedTopics.has(q.topic));
  
  if (bank.length === 0) {
    alert("Nessuna domanda trovata per gli argomenti selezionati.");
    return;
  }

  // 2. Randomize & Slice (max 20)
  currentExam = bank.sort(() => 0.5 - Math.random()).slice(0, 20);
  
  // 3. Switch View
  viewSetup.classList.remove('active');
  viewExam.classList.add('active');
  window.scrollTo(0, 0);

  // 4. Render Quiz
  renderQuizUI();
}

function renderQuizUI() {
  elQuiz.innerHTML = '';
  elGrid.innerHTML = ''; // Sidebar reset

  currentExam.forEach((q, idx) => {
    // --- SIDEBAR DOT ---
    const dot = document.createElement('div');
    dot.className = 'q-dot';
    dot.textContent = idx + 1;
    dot.id = `dot-${q.id}`;
    dot.onclick = () => document.getElementById(`card-${q.id}`).scrollIntoView({behavior:'smooth', block:'center'});
    elGrid.appendChild(dot);

    // --- MAIN CARD ---
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${q.id}`;
    
    // Header
    const topicLabel = rawData.topics.find(t => t.id === q.topic)?.label || q.topic;
    card.innerHTML = `
      <div class="q-header">
        <div class="q-text">${idx + 1}. ${q.question}</div>
        <div class="q-badge">${topicLabel}</div>
      </div>
    `;

    // Options Container
    const optDiv = document.createElement('div');
    q.options.forEach((opt, optIdx) => {
      const label = document.createElement('label');
      label.className = 'opt-label';
      label.innerHTML = `
        <input type="radio" name="${q.id}" value="${optIdx}">
        <span>${opt}</span>
      `;
      
      // Selection Handler
      label.querySelector('input').addEventListener('change', () => {
        answers.set(q.id, optIdx);
        
        // Visual updates
        const allLabels = optDiv.querySelectorAll('.opt-label');
        allLabels.forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
        
        updateProgressUI();
      });
      
      optDiv.appendChild(label);
    });

    card.appendChild(optDiv);
    
    // Explanation (Hidden)
    const expl = document.createElement('div');
    expl.className = 'explanation-box';
    expl.innerHTML = `<strong>Spiegazione:</strong> ${q.explanation || 'Nessuna spiegazione disponibile.'}`;
    card.appendChild(expl);

    elQuiz.appendChild(card);
  });
  
  updateProgressUI();
}

function updateProgressUI() {
  // Update Sidebar Dots
  currentExam.forEach((q, idx) => {
    const dot = document.getElementById(`dot-${q.id}`);
    if (answers.has(q.id)) dot.classList.add('filled');
  });

  // Update Text & Button
  elStatus.textContent = `${answers.size} di ${currentExam.length} risposte`;
  
  // Enable submit only if all answered (optional restriction, here I kept it strict)
  btnSubmit.disabled = answers.size !== currentExam.length;
}

// --- GRADING ---

btnSubmit.addEventListener('click', () => {
  if (!confirm("Confermi di voler consegnare l'esame?")) return;
  
  isSubmitted = true;
  let score = 0;

  // UI Updates for Grading
  currentExam.forEach(q => {
    const card = document.getElementById(`card-${q.id}`);
    const dot = document.getElementById(`dot-${q.id}`);
    const userAns = answers.get(q.id);
    const correctAns = q.answer_index; // Assuming JSON has 0-based index
    
    const isCorrect = userAns === correctAns;
    if (isCorrect) score++;

    // 1. Color Sidebar Dot
    dot.className = `q-dot ${isCorrect ? 'correct' : 'wrong'}`;

    // 2. Color Card Border
    card.classList.add(isCorrect ? 'correct-card' : 'wrong-card');

    // 3. Color Options & Disable Inputs
    const labels = card.querySelectorAll('.opt-label');
    labels.forEach((lbl, idx) => {
      lbl.querySelector('input').disabled = true;
      
      if (idx === correctAns) {
        lbl.classList.add('g-correct'); // Always show correct one green
      } else if (idx === userAns && !isCorrect) {
        lbl.classList.add('g-wrong'); // Show error red
      }
    });

    // 4. Show Explanation
    card.querySelector('.explanation-box').style.display = 'block';
  });

  // Show Dashboard
  showResults(score, currentExam.length);
});

function showResults(correct, total) {
  const pct = Math.round((correct / total) * 100);
  
  document.getElementById('scoreDisplay').textContent = `${correct}/${total}`;
  document.getElementById('percentageDisplay').textContent = `${pct}%`;
  
  const bar = document.getElementById('scoreBar');
  bar.style.width = `${pct}%`;
  bar.style.background = pct >= 60 ? 'var(--success)' : 'var(--error)';

  elDashboard.style.display = 'block';
  btnSubmit.style.display = 'none'; // Hide submit button
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Start
init();
