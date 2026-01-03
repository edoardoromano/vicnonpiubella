const URL = './zoologia_questions_topics_2000.json';

// --- STATE MANAGEMENT ---
const state = {
  data: null,            // Il JSON completo
  selectedTopics: new Set(),
  currentQuestions: [],  // Le domande estratte per l'esame corrente
  answers: new Map(),    // id_domanda -> index_risposta
  isSubmitted: false
};

// --- DOM ELEMENTS ---
const viewSetup = document.getElementById('view-setup');
const viewExam = document.getElementById('view-exam');
const elTopicGrid = document.getElementById('topic-grid');
const elQuizList = document.getElementById('quiz-list');
const elNavGrid = document.getElementById('nav-grid');
const btnStart = document.getElementById('btnStart');
const btnToggleAll = document.getElementById('btnToggleAll');
const btnSubmit = document.getElementById('btnSubmit');
const btnReset = document.getElementById('btnReset');

// --- INIT ---
async function init() {
  try {
    const res = await fetch(URL);
    if(!res.ok) throw new Error("File JSON non trovato o errore server");
    state.data = await res.json();
    
    // Assicuriamoci che ci siano i dati
    if (!state.data.topics || !state.data.questions) {
      throw new Error("Formato JSON non valido (manca topics o questions)");
    }

    renderSetupScreen();
  } catch (err) {
    elTopicGrid.innerHTML = `<div style="color:red; text-align:center">Errore: ${err.message}</div>`;
  }
}

// --- FASE 1: SETUP & SELEZIONE ---
function renderSetupScreen() {
  elTopicGrid.innerHTML = '';
  
  state.data.topics.forEach(topic => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.dataset.id = topic.id;
    card.innerHTML = `
      <span style="font-weight:500">${topic.label}</span>
      <div class="check-icon"></div>
    `;

    card.addEventListener('click', () => toggleTopic(topic.id, card));
    elTopicGrid.appendChild(card);
  });
}

function toggleTopic(id, cardElement) {
  if (state.selectedTopics.has(id)) {
    state.selectedTopics.delete(id);
    cardElement.classList.remove('selected');
  } else {
    state.selectedTopics.add(id);
    cardElement.classList.add('selected');
  }
  updateStartButton();
}

function updateStartButton() {
  // Conta quante domande esistono per i topic selezionati
  const poolSize = state.data.questions.filter(q => state.selectedTopics.has(q.topic)).length;
  
  btnStart.textContent = state.selectedTopics.size === 0 
    ? "Seleziona argomenti" 
    : `Avvia Esame (${poolSize} domande disp.)`;
  
  btnStart.disabled = poolSize === 0;
}

// "Seleziona Tutti" Logic
btnToggleAll.addEventListener('click', () => {
  const allCards = document.querySelectorAll('.topic-card');
  const allSelected = state.selectedTopics.size === state.data.topics.length;

  if (allSelected) {
    state.selectedTopics.clear();
    allCards.forEach(c => c.classList.remove('selected'));
    btnToggleAll.textContent = "Seleziona Tutti";
  } else {
    state.data.topics.forEach(t => state.selectedTopics.add(t.id));
    allCards.forEach(c => c.classList.add('selected'));
    btnToggleAll.textContent = "Deseleziona Tutti";
  }
  updateStartButton();
});

// --- FASE 2: AVVIO ESAME ---
btnStart.addEventListener('click', () => {
  // 1. Filtra
  const pool = state.data.questions.filter(q => state.selectedTopics.has(q.topic));
  
  // 2. Randomizza e Taglia (Max 20)
  // Shuffle Fisher-Yates semplificato
  const shuffled = pool.sort(() => 0.5 - Math.random());
  state.currentQuestions = shuffled.slice(0, 20);

  // 3. Reset Stato Esame
  state.answers.clear();
  state.isSubmitted = false;
  
  // 4. Cambio Vista
  viewSetup.classList.remove('active');
  viewExam.classList.add('active');
  window.scrollTo(0, 0);

  renderExamUI();
});

// --- RENDER ESAME ---
function renderExamUI() {
  elQuizList.innerHTML = '';
  elNavGrid.innerHTML = '';
  document.getElementById('dashboard').style.display = 'none';
  btnSubmit.style.display = 'block';

  state.currentQuestions.forEach((q, idx) => {
    // A. CREA NAV DOT (Sidebar)
    const dot = document.createElement('div');
    dot.className = 'nav-dot';
    dot.textContent = idx + 1;
    dot.id = `dot-${q.id}`;
    dot.onclick = () => document.getElementById(`card-${q.id}`).scrollIntoView({behavior:'smooth', block:'center'});
    elNavGrid.appendChild(dot);

    // B. CREA CARD DOMANDA
    const card = document.createElement('div');
    card.className = 'q-card';
    card.id = `card-${q.id}`;

    // Recupera label del topic
    const topicObj = state.data.topics.find(t => t.id === q.topic);
    const topicLabel = topicObj ? topicObj.label : q.topic;

    card.innerHTML = `
      <div class="q-meta">${topicLabel} • ID: ${q.id}</div>
      <div class="q-text">${idx + 1}. ${q.question}</div>
      <div class="opts-container" id="opts-${q.id}"></div>
      <div class="explanation"><strong>Spiegazione:</strong> ${q.explanation}</div>
    `;

    // C. CREA OPZIONI
    const optsContainer = card.querySelector(`#opts-${q.id}`);
    q.options.forEach((optText, optIdx) => {
      const label = document.createElement('label');
      label.className = 'opt-label';
      label.innerHTML = `
        <input type="radio" name="q_${q.id}" value="${optIdx}">
        <span>${optText}</span>
      `;
      
      // Gestione Click Opzione
      label.querySelector('input').addEventListener('change', () => {
        if (state.isSubmitted) return; // Blocco post-consegna
        
        state.answers.set(q.id, optIdx);
        
        // Update Grafico Opzioni
        const siblings = optsContainer.querySelectorAll('.opt-label');
        siblings.forEach(s => s.classList.remove('selected'));
        label.classList.add('selected');

        // Update Sidebar
        dot.classList.add('filled');
        
        // Update Contatore Globale
        checkProgress();
      });

      optsContainer.appendChild(label);
    });

    elQuizList.appendChild(card);
  });

  checkProgress();
}

function checkProgress() {
  const answered = state.answers.size;
  const total = state.currentQuestions.length;
  document.getElementById('status-text').textContent = `${answered}/${total} Risposte`;
  
  // Abilita consegna solo se tutte risposte date (Opzionale: puoi togliere la condizione)
  btnSubmit.disabled = answered !== total;
}

// --- FASE 3: CONSEGNA & RISULTATI ---
btnSubmit.addEventListener('click', () => {
  if (!confirm("Confermi di voler consegnare e vedere i risultati?")) return;
  
  state.isSubmitted = true;
  let correctCount = 0;
  
  // Calcolo e UI Update
  state.currentQuestions.forEach(q => {
    const userIdx = state.answers.get(q.id);
    const correctIdx = q.answer_index; // Assumo indice 0-based dal JSON
    const isCorrect = userIdx === correctIdx;
    
    if (isCorrect) correctCount++;

    const card = document.getElementById(`card-${q.id}`);
    const dot = document.getElementById(`dot-${q.id}`);

    // 1. Colora Bordo Card
    card.classList.add(isCorrect ? 'g-correct' : 'g-wrong');

    // 2. Mostra Spiegazione
    card.querySelector('.explanation').style.display = 'block';

    // 3. Colora Opzioni
    const labels = card.querySelectorAll('.opt-label');
    labels.forEach((lbl, idx) => {
      const inp = lbl.querySelector('input');
      inp.disabled = true; // Blocca input

      if (idx === correctIdx) lbl.classList.add('g-correct');
      else if (idx === userIdx) lbl.classList.add('g-wrong');
    });

    // 4. Colora Sidebar Dot
    dot.classList.remove('filled');
    dot.classList.add(isCorrect ? 'correct' : 'wrong');
  });

  // Mostra Dashboard in alto
  const dashboard = document.getElementById('dashboard');
  const scorePct = Math.round((correctCount / state.currentQuestions.length) * 100);
  
  document.getElementById('score-val').textContent = `${correctCount}/${state.currentQuestions.length} (${scorePct}%)`;
  const bar = document.getElementById('score-bar');
  bar.style.width = `${scorePct}%`;
  bar.style.backgroundColor = scorePct >= 60 ? 'var(--success)' : 'var(--error)';
  
  dashboard.style.display = 'block';
  btnSubmit.style.display = 'none';
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Reset Totale
btnReset.addEventListener('click', () => {
  if (confirm("Tornare alla selezione argomenti? I progressi attuali andranno persi.")) {
    viewExam.classList.remove('active');
    viewSetup.classList.add('active');
    state.selectedTopics.clear();
    state.answers.clear();
    renderSetupScreen();
  }
});

// Start App
init();
