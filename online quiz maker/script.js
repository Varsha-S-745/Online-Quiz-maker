/* ==========================
   Quiz Maker & Taker (No Server)
   ========================== */

document.addEventListener("DOMContentLoaded", () => {
  // Shortcuts
  const $  = (id, root = document) => root.getElementById(id);
  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Backgrounds (safe fallback: gradient stays if GIFs fail)
  const BACKGROUNDS = {
    welcome: "https://storage.needpix.com/rsynced_images/question-mark-background-1909040_1280.png",
    create:  "https://png.pngtree.com/background/20230813/original/pngtree-questions-information-writing-black-photo-picture-image_4623391.jpg",
    attend:  "https://png.pngtree.com/background/20230813/original/pngtree-questions-information-writing-black-photo-picture-image_4623391.jpg",
    quiz:    "https://storage.needpix.com/rsynced_images/question-mark-background-1909040_1280.png",
    done:    "https://storage.needpix.com/rsynced_images/question-mark-background-1909040_1280.png",
    board:   "https://png.pngtree.com/background/20230813/original/pngtree-questions-information-writing-black-photo-picture-image_4623391.jpg"
  };

  const setBG = (key) => {
    const url = BACKGROUNDS[key] || null;
    if (url) document.body.style.backgroundImage = `url("${url}")`;
  };

  const toast = (msg, ms = 1600) => {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = 1;
    setTimeout(() => { t.style.opacity = 0; }, ms);
  };

  // localStorage helpers
  const storage = {
    getQuizzes() {
      try { return JSON.parse(localStorage.getItem("quizzes") || "{}"); } catch { return {}; }
    },
    setQuizzes(obj) { localStorage.setItem("quizzes", JSON.stringify(obj)); },
    saveQuiz(quiz) {
      const q = storage.getQuizzes();
      q[quiz.code] = quiz;
      storage.setQuizzes(q);
    },
    getQuiz(code) { return storage.getQuizzes()[code]; },

    getScores() {
      try { return JSON.parse(localStorage.getItem("scores") || "{}"); } catch { return {}; }
    },
    setScores(obj) { localStorage.setItem("scores", JSON.stringify(obj)); },
    addScore(code, entry) {
      const s = storage.getScores();
      s[code] = s[code] || [];
      s[code].push(entry);
      storage.setScores(s);
    }
  };

  // Code generator
  function genCode(len = 5){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const quizzes = storage.getQuizzes();
    let out = "";
    do {
      out = "";
      for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random()*chars.length)];
    } while (quizzes[out]);
    return out;
  }

  // Render helper
  function render(html, bgKey = "welcome"){
    const app = $("app");
    if (!app) return console.error("Missing #app container.");
    app.innerHTML = html;
    setBG(bgKey);
  }

  // Screens
  function showWelcomeScreen(){
    render(`
      <section class="card center" aria-labelledby="welcome-title">
        <h1 id="welcome-title"><br>Welcome to <span class="badge">Quiz Maker</span></br></h1>
        <p class="subtitle">Create quizzes, share a code, and let friends attend—fully offline with localStorage.</p>
        <div class="btn-row center" style="justify-content:center">
          <button class="btn primary" id="btn-create">Create a Quiz</button>
          <button class="btn" id="btn-attend">Attend a Quiz</button>
        </div>
        <hr class="sep"/>
        <p class="kicker">Tip: Press <b>Enter</b> on forms to submit quickly.</p>
      </section>
    `, "welcome");

    const createBtn = $("btn-create");
    const attendBtn = $("btn-attend");
    if (createBtn) createBtn.addEventListener("click", showQuizTypeSelection);
    if (attendBtn) attendBtn.addEventListener("click", attendQuizStart);
  }

  function showQuizTypeSelection(){
    const types = [
      "General Knowledge", "Mathematics Quiz", "Science Quiz", "History Quiz",
      "Geography Quiz", "Literature/Grammar Quiz", "Technical Quiz",
      "Aptitude Quiz", "Personal Quiz", "Entertainment Quiz"
    ];
    const buttons = types.map(t => `<button class="btn" data-type="${t}">${t}</button>`).join("");

    render(`
      <section class="card">
        <h2 class="mt-0">Select Quiz Type</h2>
        <p class="subtitle">Pick a category for your new quiz.</p>
        <div class="btn-row">${buttons}</div>
        <div class="btn-row mt-14">
          <button class="btn linkish" id="back-home">← Back to Home</button>
        </div>
      </section>
    `, "create");

    $$$('.btn[data-type]').forEach(b=>{
      b.addEventListener("click", ()=> askQuestionCount(b.getAttribute("data-type")));
    });
    const back = $("back-home");
    if (back) back.addEventListener("click", showWelcomeScreen);
  }

  function askQuestionCount(selectedType){
    render(`
      <section class="card">
        <h2>How many questions?</h2>
        <form id="count-form" class="grid two" autocomplete="off">
          <div>
            <label class="label" for="qcount">Number (2–30)</label>
            <input id="qcount" class="input" type="number" min="2" max="30" required placeholder="e.g., 5"/>
          </div>
          <div class="mt-20">
            <button class="btn primary" type="submit">Start Creating</button>
          </div>
        </form>
        <div class="btn-row mt-14">
          <button class="btn linkish" id="back-types">← Back</button>
        </div>
      </section>
    `, "create");

    const form = $("count-form");
    const qcount = $("qcount");
    const back = $("back-types");
    if (qcount) qcount.focus();

    if (form) form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const n = parseInt(qcount.value, 10);
      if (isNaN(n) || n < 2 || n > 30) return toast("Enter a number between 2 and 30.");
      createQuizFlow({ type: selectedType, total: n });
    });
    if (back) back.addEventListener("click", showQuizTypeSelection);
  }

  function createQuizFlow(config){
    let idx = 0;
    const questions = [];

    function renderStep(){
      const current = idx + 1;

      render(`
        <section class="card">
          <h2 class="mt-0">Question ${current} of ${config.total}</h2>
          <form id="q-form" autocomplete="off">
            <label class="label" for="qtext">Question text</label>
            <textarea id="qtext" class="textarea" rows="3" required placeholder="Type your question here"></textarea>

            <div class="grid two mt-10">
              <div>
                <label class="label" for="choices">Number of choices (2–6)</label>
                <input id="choices" class="input" type="number" min="2" max="6" required value="4"/>
              </div>
              <div>
                <label class="label" for="answer-type">Answer mode</label>
                <select id="answer-type" class="select">
                  <option value="single">Single correct answer</option>
                  <option value="multiple">Multiple correct answers</option>
                </select>
              </div>
            </div>

            <div id="choices-wrap" class="mt-10"></div>

            <div class="btn-row mt-14">
              <button class="btn" type="button" id="btn-back">${idx===0 ? "Cancel" : "← Previous"}</button>
              <button class="btn primary" type="submit">${current===config.total ? "Finish Quiz" : "Save & Next"}</button>
            </div>
          </form>
        </section>
      `, "create");

      const wrap = $("choices-wrap");
      const choicesInput = $("choices");
      const ansTypeEl = $("answer-type");

      function buildChoices(n){
        if (!wrap) return;
        wrap.innerHTML = "";
        const type = ansTypeEl.value === "multiple" ? "checkbox" : "radio";
        for (let i = 0; i < n; i++){
          const row = document.createElement("div");
          row.className = "choice-row";
          row.innerHTML = `
            <span>#${i+1}</span>
            <input class="input" type="text" required placeholder="Choice ${i+1}" />
            <input name="correct" type="${type}" />
          `;
          wrap.appendChild(row);
        }
      }

      // Initialize choices
      const initial = parseInt(choicesInput.value || "4", 10);
      buildChoices(isNaN(initial) ? 4 : Math.min(6, Math.max(2, initial)));

      if (choicesInput) choicesInput.addEventListener("change", ()=>{
        let n = parseInt(choicesInput.value,10);
        if (isNaN(n) || n < 2) n = 2;
        if (n > 6) n = 6;
        choicesInput.value = n;
        buildChoices(n);
      });

      if (ansTypeEl) ansTypeEl.addEventListener("change", ()=>{
        const n = parseInt(choicesInput.value || "4",10);
        buildChoices(isNaN(n) ? 4 : n);
      });

      const form = $("q-form");
      if (form) form.addEventListener("submit", (e)=>{
        e.preventDefault();
        const text = $("qtext").value.trim();
        const n = parseInt(choicesInput.value,10);
        const mode = ansTypeEl.value;

        if (!text) return toast("Question cannot be empty.");
        const rows = $$$(".choice-row", wrap);
        const choices = [];
        const correct = [];
        rows.forEach((row, i)=>{
          const inputEl = $$(".input", row);
          const checkEl = $$('input[type="radio"], input[type="checkbox"]', row);
          const val = inputEl ? inputEl.value.trim() : "";
          const ok = checkEl ? checkEl.checked : false;
          if (!val) choices.push(""); else choices.push(val);
          if (ok) correct.push(i);
        });

        if (choices.some(c => !c)) return toast("All choices must be filled.");
        if (correct.length === 0) return toast("Select at least one correct answer.");
        if (mode === "single" && correct.length !== 1) return toast("Exactly one answer must be correct for single mode.");

        questions[idx] = { text, choices, type: mode, correct };
        idx++;

        if (idx < config.total) {
          renderStep();
        } else {
          const code = genCode();
          const quiz = { code, type: config.type, createdAt: Date.now(), questions };
          storage.saveQuiz(quiz);
          render(`
            <section class="card center">
              <h2>Quiz Created! 🎉</h2>
              <p class="subtitle">Share this code so others can attend:</p>
              <div style="font-size: 40px; letter-spacing: 6px; margin: 6px 0;">
                <span class="badge">${code}</span>
              </div>
              <p class="kicker">Saved locally on this device.</p>
              <div class="btn-row" style="justify-content:center; margin-top: 16px;">
                <button class="btn" id="btn-create-another">Create Another</button>
                <button class="btn primary" id="btn-home">Back to Home</button>
              </div>
            </section>
          `, "done");

          const again = $("btn-create-another");
          const home = $("btn-home");
          if (again) again.addEventListener("click", showQuizTypeSelection);
          if (home) home.addEventListener("click", showWelcomeScreen);
        }
      });

      const backBtn = $("btn-back");
      if (backBtn) backBtn.addEventListener("click", ()=>{
        if (idx === 0) { showWelcomeScreen(); return; }
        idx--;
        renderStep();
      });
    }

    renderStep();
  }

  function attendQuizStart(){
    render(`
      <section class="card">
        <h2 class="mt-0">Attend a Quiz</h2>
        <form id="attend-form" class="grid two" autocomplete="off">
          <div>
            <label class="label" for="player">Your Name</label>
            <input id="player" class="input" type="text" required placeholder="e.g., Alex"/>
          </div>
          <div>
            <label class="label" for="code">Quiz Code</label>
            <input id="code" class="input" type="text" required placeholder="e.g., 7KX3P" maxlength="8"/>
          </div>
          <div class="mt-20">
            <button class="btn primary" type="submit">Start</button>
          </div>
        </form>
        <div class="btn-row mt-14">
          <button class="btn linkish" id="back-home">← Back to Home</button>
        </div>
      </section>
    `, "attend");

    const form = $("attend-form");
    const nameEl = $("player");
    const codeEl = $("code");
    const back = $("back-home");
    if (nameEl) nameEl.focus();

    if (form) form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const name = nameEl.value.trim();
      const code = codeEl.value.trim().toUpperCase();
      if (!name || !code) return toast("Enter your name and the quiz code.");
      const quiz = storage.getQuiz(code);
      if (!quiz) return toast("No quiz found for that code.");
      attendQuizFlow(name, quiz);
    });
    if (back) back.addEventListener("click", showWelcomeScreen);
  }

  function attendQuizFlow(playerName, quiz){
    let idx = 0;
    const answers = [];

    function renderQ(){
      const q = quiz.questions[idx];
      const total = quiz.questions.length;
      const mode = q.type;

      render(`
        <section class="card">
          <div class="grid two">
            <div>
              <h3 class="mt-0">${quiz.type}</h3>
              <p class="kicker">Code: <b>${quiz.code}</b></p>
            </div>
            <div class="center">
              <span class="badge">Question ${idx+1} / ${total}</span>
            </div>
          </div>

          <h2 class="mt-10">${q.text}</h2>
          <form id="ans-form" class="grid mt-10" autocomplete="off">
            ${q.choices.map((ch, i) => `
              <label class="option">
                <input type="${mode==='multiple'?'checkbox':'radio'}" name="ans" value="${i}" />
                <span>${ch}</span>
              </label>
            `).join("")}

            <div class="btn-row mt-14">
              <button class="btn" type="button" id="btn-prev" ${idx===0?'disabled':''}>← Previous</button>
              <button class="btn primary" type="submit">${idx===total-1?'Finish':'Next →'}</button>
            </div>
          </form>
        </section>
      `, "quiz");

      // Pre-check previously selected
      const prev = answers[idx] || [];
      if (prev.length){
        prev.forEach(v=>{
          const input = $$(`#ans-form input[value="${v}"]`);
          if (input) input.checked = true;
        });
      }

      const form = $("ans-form");
      const prevBtn = $("btn-prev");

      if (form) form.addEventListener("submit", (e)=>{
        e.preventDefault();
        const selected = $$$('input[name="ans"]:checked', form).map(i=>parseInt(i.value,10));
        if (selected.length===0) { toast("Select at least one option."); return; }
        answers[idx] = selected;
        if (idx < total-1){ idx++; renderQ(); }
        else { finish(); }
      });

      if (prevBtn) prevBtn.addEventListener("click", ()=>{
        if (idx>0){ idx--; renderQ(); }
      });
    }

    function finish(){
      let score = 0;
      quiz.questions.forEach((q, i)=>{
        const sel = (answers[i] || []).slice().sort().join(",");
        const cor = q.correct.slice().sort().join(",");
        if (sel === cor) score++;
      });

      storage.addScore(quiz.code, {
        name: playerName,
        score,
        total: quiz.questions.length,
        at: Date.now()
      });

      render(`
        <section class="card center">
          <h2>All done, ${playerName}! 🎯</h2>
          <p class="subtitle">Your score for code <b>${quiz.code}</b>:</p>
          <div style="font-size: 42px; margin: 8px 0;">
            <span class="badge">${score} / ${quiz.questions.length}</span>
          </div>
          <div class="btn-row" style="justify-content:center; margin-top: 16px;">
            <button class="btn" id="btn-again">Play Again</button>
            <button class="btn" id="btn-board">View Scoreboard</button>
            <button class="btn primary" id="btn-home">Back to Home</button>
          </div>
        </section>
      `, "done");

      const again = $("btn-again");
      const home = $("btn-home");
      const board = $("btn-board");
      if (again) again.addEventListener("click", attendQuizStart);
      if (home) home.addEventListener("click", showWelcomeScreen);
      if (board) board.addEventListener("click", ()=> showScoreboard(quiz.code));
    }

    renderQ();
  }

  function showScoreboard(focusCode = null){
    const quizzes = storage.getQuizzes();
    const codes = Object.keys(quizzes).sort((a,b)=> (quizzes[b].createdAt||0) - (quizzes[a].createdAt||0));
    const scores = storage.getScores();

    const dropdown = codes.length ? `
      <select id="board-code" class="select">
        ${codes.map(c => `<option value="${c}" ${focusCode===c?'selected':''}>${c} — ${quizzes[c].type}</option>`).join("")}
      </select>
    ` : `<span class="kicker">No quizzes yet.</span>`;

    render(`
      <section class="card">
        <h2 class="mt-0">Scoreboard</h2>
        <div class="grid two">
          <div>
            <label class="label">Select quiz code</label>
            ${dropdown}
          </div>
          <div class="mt-20">
            <button class="btn" id="btn-clear">Clear Scores for Code</button>
            <button class="btn linkish" id="btn-clear-all">Clear ALL Scores</button>
          </div>
        </div>

        <div id="board-table" class="mt-14"></div>

        <div class="btn-row mt-14">
          <button class="btn" id="btn-home">← Back to Home</button>
        </div>
      </section>
    `, "board");

    const boardCodeEl = $("board-code");
    const tableWrap = $("board-table");

    function drawTable(codeSel){
      if (!tableWrap) return;
      tableWrap.innerHTML = "";
      if (!codeSel){ tableWrap.innerHTML = `<p class="kicker">No quiz selected.</p>`; return; }
      const entries = (scores[codeSel] || []).slice().sort((a,b)=> b.score - a.score || a.at - b.at);
      if (entries.length===0){
        tableWrap.innerHTML = `<p class="kicker">No one has attended this quiz yet.</p>`;
        return;
      }
      const rows = entries.map((e,i)=>`
        <tr>
          <td>${i+1}</td>
          <td>${e.name}</td>
          <td>${e.score} / ${e.total}</td>
          <td>${new Date(e.at).toLocaleString()}</td>
        </tr>
      `).join("");
      tableWrap.innerHTML = `
        <div style="overflow:auto;">
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.25);">#</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.25);">Player</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.25);">Score</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.25);">Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    if (boardCodeEl){
      drawTable(boardCodeEl.value);
      boardCodeEl.addEventListener("change", ()=> drawTable(boardCodeEl.value));
    } else {
      drawTable(null);
    }

    const home = $("btn-home");
    const clear = $("btn-clear");
    const clearAll = $("btn-clear-all");

    if (home) home.addEventListener("click", showWelcomeScreen);

    if (clear) clear.addEventListener("click", ()=>{
      if (!boardCodeEl) return;
      const code = boardCodeEl.value;
      const s = storage.getScores();
      if (!s[code] || s[code].length===0){ toast("No scores to clear."); return; }
      if (confirm(`Clear all scores for ${code}?`)){
        s[code] = [];
        storage.setScores(s);
        drawTable(code);
        toast("Scores cleared.");
      }
    });

    if (clearAll) clearAll.addEventListener("click", ()=>{
      if (confirm("This will clear ALL scores for ALL quizzes on this device.")){
        storage.setScores({});
        if (boardCodeEl) drawTable(boardCodeEl.value);
        toast("All scores cleared.");
      }
    });
  }

  // Global nav: scoreboard (null-safe)
  const boardLink = $("scoreboard-link");
  if (boardLink) boardLink.addEventListener("click", (e)=>{ e.preventDefault(); showScoreboard(); });

  // Boot
  showWelcomeScreen();
});
