const API_URL = "https://jsonplaceholder.typicode.com/posts";
const NOTES_TO_LOAD = 10;

const loadButton = document.querySelector("#load-btn");
const statusElement = document.querySelector("#status");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");
const notesList = document.querySelector("#notes-list");

let notes = [];
let nextLocalId = -1;

function setStatus(message, state = "idle") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

// All HTTP calls share response checking, JSON parsing, and error behavior.
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function getNotes() {
  try {
    setStatus("Loading notes…", "loading");
    loadButton.disabled = true;
    notesList.replaceChildren();

    const data = await request(`${API_URL}?_limit=${NOTES_TO_LOAD}`);
    if (!Array.isArray(data)) throw new Error("The API returned an unexpected response.");

    notes = data;
    renderNotes(notes);
    setStatus(notes.length ? `Successfully loaded ${notes.length} notes.` : "No notes yet. Create one to get started.", notes.length ? "success" : "empty");
  } catch (error) {
    notes = [];
    renderNotes(notes);
    setStatus("Could not load notes. Check your connection and try again.", "error");
    console.error("GET notes failed:", error);
  } finally {
    loadButton.disabled = false;
  }
}

async function createNote(title, body) {
  try {
    submitButton.disabled = true;
    loadButton.disabled = true;
    setStatus("Creating note…", "loading");

    const created = await request(API_URL, {
      method: "POST",
      body: JSON.stringify({ title, body, userId: 1 })
    });

    // JSONPlaceholder simulates POST; keep the result visible for this page session.
    const localNote = {
      id: nextLocalId--,
      title: created?.title ?? title,
      body: created?.body ?? body,
      userId: created?.userId ?? 1
    };
    notes = [localNote, ...notes];
    renderNotes(notes);
    noteForm.reset();
    setStatus("Note created successfully (demo API response).", "success");
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
    console.error("POST note failed:", error);
  } finally {
    submitButton.disabled = false;
    loadButton.disabled = false;
  }
}

async function deleteNote(id, button) {
  try {
    button.disabled = true;
    submitButton.disabled = true;
    loadButton.disabled = true;
    setStatus("Deleting note…", "loading");

    // Negative IDs represent notes added in this browser session only.
    if (id >= 0) {
      await request(`${API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
    }

    notes = notes.filter((note) => note.id !== id);
    renderNotes(notes);
    setStatus("Note deleted successfully (demo API response).", "success");
  } catch (error) {
    button.disabled = false;
    setStatus("Could not delete the note. Please try again.", "error");
    console.error("DELETE note failed:", error);
  } finally {
    submitButton.disabled = false;
    loadButton.disabled = false;
  }
}

function renderNotes(list) {
  notesList.replaceChildren();
  if (list.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "note-card";
    const message = document.createElement("p");
    message.textContent = "No notes to show yet. Load notes or create one above.";
    emptyItem.append(message);
    notesList.append(emptyItem);
    return;
  }

  list.forEach((note) => {
    const item = document.createElement("li");
    item.className = "note-card";

    const title = document.createElement("h3");
    title.textContent = note.title ?? "Untitled note";
    const body = document.createElement("p");
    body.textContent = note.body ?? "";
    const meta = document.createElement("span");
    meta.className = "note-meta";
    meta.textContent = `Note ID: ${note.id}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-btn";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", () => deleteNote(note.id, removeButton));

    item.append(title, body, meta, removeButton);
    notesList.append(item);
  });
}

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("A title is required.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }
  await createNote(title, body);
});

loadButton.addEventListener("click", getNotes);
