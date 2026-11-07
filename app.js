// =====================================================
// 1. ПОДКЛЮЧЕНИЕ К БАЗЕ
// =====================================================
// Адрес базы и публичный ключ — их можно хранить в коде,
// данные защищены правилами RLS в Supabase.
const SUPABASE_URL = "https://tzjobxbeymzanpbjntrx.supabase.co";
const SUPABASE_KEY = "sb_publishable_5fhSG_7X1bj9Rx8I9Q3JUg_wsy_udOa";

// Создаём «пульт управления» базой. Через db мы будем
// входить, сохранять и читать слова.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// =====================================================
// 2. НАХОДИМ ЭЛЕМЕНТЫ НА СТРАНИЦЕ
// =====================================================
// document.getElementById("...") находит элемент по его id в HTML
const loginScreen = document.getElementById("login-screen");
const appScreen   = document.getElementById("app-screen");
const loginForm   = document.getElementById("login-form");
const loginError  = document.getElementById("login-error");
const logoutBtn   = document.getElementById("logout-btn");
const addForm     = document.getElementById("add-form");
const addMessage  = document.getElementById("add-message");
const wordList    = document.getElementById("word-list");


// =====================================================
// 3. ВХОД И ВЫХОД
// =====================================================

// Показывает нужный экран: вход или приложение
function showScreen(session) {
  if (session) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    loadWords();
  } else {
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
}

// Supabase сам сообщает, когда ты вошла или вышла.
// Сессия сохраняется в браузере, поэтому повторно входить не нужно.
db.auth.onAuthStateChange((event, session) => {
  showScreen(session);
});

// Нажали «Войти»
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // не перезагружать страницу
  loginError.textContent = "";

  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  // await = «подожди ответа от сервера, потом иди дальше»
  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      loginError.textContent = "Неверный email или пароль";
    } else if (error.message.includes("Email not confirmed")) {
      loginError.textContent = "Email не подтверждён — подтверди пользователя в Supabase";
    } else {
      loginError.textContent = "Ошибка: " + error.message;
    }
  }
});

// Нажали «Выйти»
logoutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
});


// =====================================================
// 4. ЗАГРУЗКА И ПОКАЗ СЛОВ
// =====================================================

async function loadWords() {
  // «Дай все мои слова, новые сверху».
  // Фильтр по пользователю писать не нужно — RLS сам отдаст только твои.
  const { data: words, error } = await db
    .from("words")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    wordList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "Не удалось загрузить слова: " + error.message;
    wordList.appendChild(li);
    return;
  }

  renderStats(words);
  renderList(words);
}

// Считаем статистику
function renderStats(words) {
  const count = (status) => words.filter((w) => w.status === status).length;
  document.getElementById("stat-total").textContent    = words.length;
  document.getElementById("stat-new").textContent      = count("new");
  document.getElementById("stat-learning").textContent = count("learning");
  document.getElementById("stat-learned").textContent  = count("learned");
}

// Рисуем список слов
function renderList(words) {
  wordList.innerHTML = "";

  if (words.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Пока нет слов — добавь первое 👆";
    wordList.appendChild(li);
    return;
  }

  const statusNames = { new: "новое", learning: "учу", learned: "выучено" };

  for (const w of words) {
    const li = document.createElement("li");

    // Текст слова. Используем textContent, а не innerHTML —
    // так никакой текст не сможет «сломать» страницу.
    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "word";
    title.textContent = w.word + (w.transcription ? "  " + w.transcription : "");

    const translation = document.createElement("div");
    translation.textContent = w.translation;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = statusNames[w.status] + (w.source ? " · " + w.source : "");

    info.append(title, translation, meta);

    if (w.example) {
      const ex = document.createElement("div");
      ex.className = "example";
      ex.textContent = w.example;
      info.appendChild(ex);
    }

    // Кнопка удаления
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "🗑";
    del.title = "Удалить";
    del.addEventListener("click", () => deleteWord(w));

    li.append(info, del);
    wordList.appendChild(li);
  }
}


// =====================================================
// 5. ДОБАВЛЕНИЕ И УДАЛЕНИЕ
// =====================================================

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  addMessage.textContent = "";
  addMessage.className = "";

  // Берём значения из полей. || null = «если пусто, сохранить пустоту»
  const newWord = {
    word:          document.getElementById("f-word").value.trim(),
    translation:   document.getElementById("f-translation").value.trim(),
    transcription: document.getElementById("f-transcription").value.trim() || null,
    example:       document.getElementById("f-example").value.trim() || null,
    source:        document.getElementById("f-source").value.trim() || null,
  };

  // «Вставь новую строку в таблицу words»
  const { error } = await db.from("words").insert(newWord);

  if (error) {
    addMessage.className = "error";
    // 23505 — код ошибки «такое уже есть» (наш unique index)
    addMessage.textContent = error.code === "23505"
      ? "Это слово уже есть в списке"
      : "Ошибка: " + error.message;
    return;
  }

  addMessage.className = "success";
  addMessage.textContent = "✅ «" + newWord.word + "» добавлено";

  // Очищаем поля, но источник оставляем —
  // удобно, когда добавляешь много слов из одной книги
  const source = document.getElementById("f-source").value;
  addForm.reset();
  document.getElementById("f-source").value = source;
  document.getElementById("f-word").focus();

  loadWords();
});

async function deleteWord(w) {
  if (!confirm("Удалить слово «" + w.word + "»?")) return;

  const { error } = await db.from("words").delete().eq("id", w.id);
  if (error) {
    alert("Не удалось удалить: " + error.message);
    return;
  }
  loadWords();
}
