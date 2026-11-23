"use strict";

const STORAGE_KEY = "studyflow.topics.v1";
const PALETTE = [
  { background: "#edf4ee", color: "#5b8b65", dot: "#79a984" },
  { background: "#f2eff8", color: "#8873ac", dot: "#a18bc7" },
  { background: "#fbf1e9", color: "#bd8158", dot: "#d19a72" },
  { background: "#eef2f8", color: "#6d83a4", dot: "#8da2bf" },
  { background: "#f8eff1", color: "#a47481", dot: "#c48d9b" }
];
const SUBJECTS = [
  { name: "Biology", terms: ["biology", "cell", "cells", "dna", "rna", "photosynthesis", "ecosystem", "mitosis", "meiosis", "organism", "genetics", "evolution", "enzyme", "chloroplast", "mitochondria"] },
  { name: "Chemistry", terms: ["chemistry", "chemical", "atom", "atoms", "molecule", "molecules", "element", "elements", "compound", "reaction", "bond", "periodic table", "acid", "base", "electron", "proton"] },
  { name: "Physics", terms: ["physics", "force", "velocity", "acceleration", "gravity", "energy", "momentum", "motion", "newton", "wave", "electricity", "voltage", "mass", "friction"] },
  { name: "Psychology", terms: ["psychology", "behavior", "behaviour", "cognitive", "memory", "conditioning", "reinforcement", "development", "attachment", "neuron", "perception", "consciousness"] },
  { name: "History", terms: ["history", "revolution", "empire", "treaty", "war", "century", "colonial", "civilization", "civilisation", "independence", "monarchy", "industrialization"] },
  { name: "Economics", terms: ["economics", "economy", "supply", "demand", "inflation", "gdp", "market", "consumer", "opportunity cost", "scarcity", "fiscal", "monetary"] },
  { name: "Computer science", terms: ["computer science", "algorithm", "programming", "code", "software", "database", "binary", "function", "variable", "data structure", "network", "recursion"] },
  { name: "Mathematics", terms: ["mathematics", "algebra", "equation", "equations", "geometry", "calculus", "derivative", "integral", "probability", "theorem", "fraction", "quadratic"] },
  { name: "Literature", terms: ["literature", "novel", "poem", "poetry", "metaphor", "narrative", "character", "theme", "protagonist", "symbolism", "shakespeare"] }
];

const elements = {
  textarea: document.querySelector("#notes-input"),
  organizeButton: document.querySelector("#organize-button"),
  sampleButton: document.querySelector("#sample-button"),
  wordCount: document.querySelector("#word-count"),
  savedStatus: document.querySelector(".saved-status"),
  topicNav: document.querySelector("#topic-nav"),
  topicCount: document.querySelector("#topic-count"),
  pathContent: document.querySelector("#path-content"),
  pathStatus: document.querySelector("#path-status"),
  breadcrumb: document.querySelector("#breadcrumb-current"),
  dialog: document.querySelector("#study-dialog"),
  dialogContent: document.querySelector("#study-dialog-content"),
  toast: document.querySelector("#toast"),
  aiStatus: document.querySelector("#ai-status"),
  aiStatusLabel: document.querySelector("#ai-status-label"),
  uploadZone: document.querySelector("#upload-zone"),
  fileInput: document.querySelector("#file-input"),
  uploadMeta: document.querySelector("#upload-meta"),
  studentProfileButton: document.querySelector("#student-profile-open"),
  studentAvatar: document.querySelector("#student-avatar"),
  studentProfileName: document.querySelector("#student-profile-name"),
  studentProfileSummary: document.querySelector("#student-profile-summary"),
  heroHeading: document.querySelector("#hero-heading"),
  workspaceImportFile: document.querySelector("#workspace-import-file")
};

const PROFILE_KEY = "studyflow.profile.v1";
const STUDENT_PROFILE_KEY = "studyflow.student-profile.v1";
const STUDY_PRESETS = {
  "exam-cram": {
    label: "Exam Cram",
    goal: "Prioritize high-yield concepts and concise retrieval practice for an upcoming exam."
  },
  "lecture-summary": {
    label: "Lecture Summary",
    goal: "Create a structured, concise summary of lecture notes with key terms and takeaways."
  },
  "past-paper-prep": {
    label: "Past-Paper Prep",
    goal: "Use past-paper questions and exam-style practice, grounding answers in my course notes."
  },
  "assignment-rubric": {
    label: "Assignment Rubric",
    goal: "Organize concepts around the assignment rubric and highlight relevant evidence in my notes."
  }
};

let topics = loadTopics();
let activeTopicId = null;
let toastTimer;
let aiAvailable = false;
let uploadName = "";
let studentProfile = loadStudentProfile();

function setMode(isAi, message) {
  aiAvailable = Boolean(isAi);
  elements.aiStatus.classList.toggle("ai-mode", aiAvailable);
  elements.aiStatus.classList.toggle("local-mode", !aiAvailable);
  elements.aiStatusLabel.textContent = message || (aiAvailable ? "AI tutor ready" : "Local demo mode");
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("Studyflow server unavailable");
    const data = await response.json();
    setMode(data.aiConfigured, data.aiConfigured ? `AI configured · ${data.model}` : "Local demo mode · AI not configured");
  } catch (_error) {
    setMode(false, "Local demo mode · server unavailable");
  }
}

function getCourseProfile() {
  return {
    institution: document.querySelector("#profile-institution").value.trim(),
    course: document.querySelector("#profile-course").value.trim(),
    level: document.querySelector("#profile-level").value.trim(),
    assessmentType: document.querySelector("#profile-assessment").value,
    rubric: document.querySelector("#profile-rubric").value.trim(),
    pastPaper: document.querySelector("#profile-past-paper").value.trim()
  };
}

function getProfile() {
  return {
    ...getCourseProfile(),
    studentName: studentProfile.firstName,
    degree: studentProfile.degree,
    studyGoal: studentProfile.studyGoal,
    studyPreset: studentProfile.preset
  };
}

function loadStudentProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDENT_PROFILE_KEY) || "{}");
    return {
      firstName: typeof saved.firstName === "string" ? saved.firstName : "",
      degree: typeof saved.degree === "string" ? saved.degree : "",
      studyGoal: typeof saved.studyGoal === "string" ? saved.studyGoal : "",
      preset: typeof saved.preset === "string" && Object.prototype.hasOwnProperty.call(STUDY_PRESETS, saved.preset) ? saved.preset : ""
    };
  } catch (error) {
    console.error("Could not load the student profile.", error);
    localStorage.removeItem(STUDENT_PROFILE_KEY);
    return { firstName: "", degree: "", studyGoal: "", preset: "" };
  }
}

function renderStudentProfile() {
  const firstName = studentProfile.firstName.trim();
  const degree = studentProfile.degree.trim();
  elements.studentAvatar.textContent = firstName ? firstName.charAt(0).toUpperCase() : "S";
  elements.studentProfileName.textContent = firstName || "Student profile";
  elements.studentProfileSummary.textContent = degree || "Add your course and study goal";
  elements.heroHeading.innerHTML = firstName
    ? `Ready to study,<br class="mobile-break"> <span class="heading-accent">${escapeHtml(firstName)}.</span>`
    : 'Make your notes<br class="mobile-break"> make <span class="heading-accent">sense.</span>';
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    document.querySelector("#profile-institution").value = saved.institution || "";
    document.querySelector("#profile-course").value = saved.course || "";
    document.querySelector("#profile-level").value = saved.level || "";
    document.querySelector("#profile-assessment").value = saved.assessmentType || "";
    document.querySelector("#profile-rubric").value = saved.rubric || "";
    document.querySelector("#profile-past-paper").value = saved.pastPaper || "";
  } catch (_error) {
    localStorage.removeItem(PROFILE_KEY);
  }
}

async function requestApi(endpoint, body) {
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function topicContext(topic) {
  return topic.sections.map(section => `SECTION: ${section.title}\n${section.text}`).join("\n\n");
}

function createAiTopics(groups, sourceMode) {
  const stamp = Date.now();
  return groups.map((group, groupIndex) => ({
    id: `${stamp}-${groupIndex}-${Math.random().toString(36).slice(2, 8)}`,
    title: group.title || `Topic ${groupIndex + 1}`,
    category: group.category || group.title || "Your notes",
    color: PALETTE[(topics.length + groupIndex) % PALETTE.length],
    createdAt: new Date().toISOString(),
    sourceMode,
    sections: (group.sections || []).map((section, sectionIndex) => ({
      id: `${stamp}-${groupIndex}-${sectionIndex}`,
      title: section.title || `Section ${sectionIndex + 1}`,
      text: section.text || "",
      keyPoints: Array.isArray(section.keyPoints) && section.keyPoints.length
        ? section.keyPoints
        : getKeyPoints(section.text || "")
    })).filter(section => section.text)
  })).filter(topic => topic.sections.length);
}

function loadTopics() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("Saved topics are not a list.");
    return parsed.filter(topic =>
      topic &&
      typeof topic.id === "string" &&
      typeof topic.title === "string" &&
      Array.isArray(topic.sections)
    );
  } catch (error) {
    console.error("Could not load saved Studyflow notes.", error);
    window.addEventListener("DOMContentLoaded", () => showToast("Saved notes could not be loaded. You can still add new notes."));
    return [];
  }
}

function persistTopics() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
    elements.savedStatus.innerHTML = '<span class="status-dot"></span> All changes saved';
    return true;
  } catch (error) {
    console.error("Could not save Studyflow notes.", error);
    elements.savedStatus.textContent = "Could not save changes";
    showToast("Could not save notes on this device. Check your browser storage settings.");
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message, duration = 3200) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), duration);
}

function countWords(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatWordCount(count) {
  return `${count.toLocaleString()} ${count === 1 ? "word" : "words"}`;
}

function cleanLine(line) {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
}

function looksLikeHeading(line, nextLine) {
  const value = line.trim();
  if (!value) return false;
  if (/^#{1,6}\s+\S/.test(value) || /^.{2,65}:$/.test(value)) return true;
  if (/^\d+(?:\.\d+)*\s+\S.{0,60}$/.test(value) && !/[.!?]$/.test(value)) return true;
  const letters = value.replace(/[^A-Za-z]/g, "");
  const isUppercase = letters.length > 2 && letters === letters.toUpperCase();
  if (isUppercase && value.length <= 60) return true;
  if (nextLine && value.length <= 60 && !/[.!?]$/.test(value) && !/^[>*•-]/.test(value)) return true;
  const commonHeadings = /^(introduction|overview|background|key concepts?|definitions?|examples?|causes|effects|types|functions|summary|conclusion|process|structure|importance|applications?)$/i;
  return Boolean(nextLine && commonHeadings.test(value) && !/[.!?]$/.test(value));
}

function splitIntoSections(notes) {
  const lines = notes.replace(/\r/g, "").split("\n");
  const nextTextLine = index => lines.slice(index + 1).find(line => line.trim());
  const hasHeadings = lines.some((line, index) => looksLikeHeading(line, nextTextLine(index)));
  if (hasHeadings) {
    const sections = [];
    let currentTitle = "Overview";
    let currentLines = [];
    const saveSection = () => {
      const text = currentLines.join("\n").trim();
      if (text) sections.push({ title: currentTitle, text });
    };

    lines.forEach((line, index) => {
      if (looksLikeHeading(line, nextTextLine(index))) {
        saveSection();
        currentTitle = line.trim().replace(/^#{1,6}\s*/, "").replace(/:$/, "");
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    });
    saveSection();
    return sections;
  }

  const paragraphs = notes
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
  const chunks = paragraphs.length > 1
    ? paragraphs
    : splitSentences(notes).reduce((groups, sentence, index) => {
      const groupIndex = Math.floor(index / 4);
      if (!groups[groupIndex]) groups[groupIndex] = [];
      groups[groupIndex].push(sentence);
      return groups;
    }, []).map(group => group.join(" "));

  return chunks.map((text, index) => ({
    title: getSectionTitle(text, index),
    text
  }));
}

function splitSentences(text) {
  return text.replace(/\r/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(sentence => sentence.trim()).filter(Boolean);
}

function getSectionTitle(text, index) {
  const firstLine = text.split("\n").map(cleanLine).find(Boolean) || "";
  const sentence = splitSentences(firstLine)[0] || firstLine;
  const compact = sentence.replace(/[.!?]+$/, "").trim();
  if (compact.length <= 49) return compact || `Key idea ${index + 1}`;
  const words = compact.split(/\s+/).slice(0, 7).join(" ");
  return `${words}…`;
}

function findSubject(text) {
  const normalized = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  SUBJECTS.forEach(subject => {
    const score = subject.terms.reduce((total, term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = normalized.match(new RegExp(`\\b${escaped}\\b`, "g"));
      return total + (matches ? matches.length : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = subject.name;
    }
  });
  return best;
}

function inferTitle(section, index) {
  if (section.title && !/^key idea \d+$/i.test(section.title) && section.title !== "Overview") return section.title;
  const firstLine = section.text.split("\n").map(cleanLine).find(Boolean) || "";
  const words = firstLine.replace(/[.!?]+$/, "").split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length ? words.join(" ") : `Topic ${index + 1}`;
}

function makeTopicGroups(sections, notes) {
  const overallSubject = findSubject(notes);
  const groups = new Map();
  sections.forEach((section, index) => {
    const category = findSubject(`${section.title} ${section.text}`) || overallSubject || "Your notes";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      title: inferTitle(section, index),
      text: section.text,
      keyPoints: getKeyPoints(section.text)
    });
  });

  const topicTitle = category => {
    if (category !== "Your notes") return category;
    const firstSection = sections[0];
    if (!firstSection) return "Your notes";
    const title = inferTitle(firstSection, 0);
    return title.length > 35 ? `${title.slice(0, 32).trimEnd()}…` : title;
  };

  return Array.from(groups, ([category, groupedSections], index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    title: topicTitle(category),
    category,
    color: PALETTE[index % PALETTE.length],
    createdAt: new Date().toISOString(),
    sections: groupedSections
  }));
}

function getKeyPoints(text) {
  const lines = text.split(/\n/).map(cleanLine).filter(Boolean);
  const candidates = lines.length > 1 ? lines : splitSentences(text);
  const points = candidates
    .map(point => point.replace(/\s+/g, " ").trim())
    .filter(point => point.length > 8)
    .slice(0, 5);
  return points.length ? points : [text.trim()];
}

function renderTopics() {
  elements.topicNav.innerHTML = "";
  if (!topics.length) {
    elements.topicNav.innerHTML = '<p class="sidebar-empty">Your topics will show up here.</p>';
  } else {
    topics.slice().reverse().forEach(topic => {
      const row = document.createElement("div");
      row.className = "topic-link-row";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = `topic-link${activeTopicId === topic.id ? " selected" : ""}`;
      openButton.dataset.topicId = topic.id;
      openButton.innerHTML = `<span class="topic-dot" style="background:${escapeHtml(topic.color?.dot || PALETTE[0].dot)}"></span><span class="topic-link-label">${escapeHtml(topic.title)}</span>`;
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "topic-delete";
      deleteButton.dataset.action = "delete-topic";
      deleteButton.dataset.topicId = topic.id;
      deleteButton.setAttribute("aria-label", `Delete ${topic.title}`);
      deleteButton.title = `Delete ${topic.title}`;
      deleteButton.textContent = "×";
      row.append(openButton, deleteButton);
      elements.topicNav.append(row);
    });
  }
  elements.topicCount.textContent = String(topics.length);
  renderPath();
}

function renderPath() {
  if (!topics.length) {
    elements.pathStatus.classList.remove("ready");
    elements.pathStatus.innerHTML = "<span></span> ADD NOTES TO START";
    elements.pathContent.className = "path-content";
    elements.pathContent.innerHTML = `
      <div class="empty-path-art" aria-hidden="true">
        <div class="path-orbit orbit-one"></div><div class="path-orbit orbit-two"></div>
        <div class="path-center"><svg viewBox="0 0 40 40"><path d="M11 8.5h11.5a4 4 0 0 1 4 4V32a4 4 0 0 0-4-4H11a2 2 0 0 1-2-2V10.5a2 2 0 0 1 2-2Z"/><path d="M29 8.5h-2.5a4 4 0 0 0-4 4V32a4 4 0 0 1 4-4H29a2 2 0 0 0 2-2V10.5a2 2 0 0 0-2-2Z"/><path d="M13 14h5M13 19h5M26 14h1"/></svg></div>
        <span class="orbit-dot dot-a"></span><span class="orbit-dot dot-b"></span><span class="orbit-dot dot-c"></span>
      </div>
      <h3>A little clarity goes<br> a long way.</h3>
      <p>Your class materials become clear topics, key ideas, and practice you can return to.</p>
      <div class="empty-path-tags"><span>Topics</span><i>·</i><span>Key ideas</span><i>·</i><span>Quick quiz</span></div>`;
    return;
  }

  const sectionCount = topics.reduce((sum, topic) => sum + topic.sections.length, 0);
  const latest = topics[topics.length - 1];
  elements.pathStatus.classList.add("ready");
  elements.pathStatus.innerHTML = "<span></span> READY TO EXPLORE";
  elements.pathContent.className = "path-content has-topics";
  elements.pathContent.innerHTML = `
    <div class="path-topic-overview">
      <span class="overview-icon" style="background:${escapeHtml(latest.color.background)};color:${escapeHtml(latest.color.color)}"><svg viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v7H4V5.5ZM14 4h4.5A1.5 1.5 0 0 1 20 5.5V11h-6V4ZM4 15h6v5H5.5A1.5 1.5 0 0 1 4 18.5V15ZM14 14h6v4.5a1.5 1.5 0 0 1-1.5 1.5H14v-6Z"/></svg></span>
      <span><strong>${escapeHtml(latest.title)}</strong><small>${latest.sections.length} ${latest.sections.length === 1 ? "section" : "sections"} · just added</small></span>
    </div>
    <div class="path-topic-list">${topics.slice().reverse().map(topic => `
      <div class="path-topic-row">
        <button class="path-topic-open" type="button" data-topic-id="${escapeHtml(topic.id)}">
          <span class="topic-dot" style="background:${escapeHtml(topic.color?.dot || PALETTE[0].dot)}"></span>
          <strong>${escapeHtml(topic.title)}</strong>
          <small>${topic.sections.length} ${topic.sections.length === 1 ? "section" : "sections"}</small>
          <span class="row-arrow" aria-hidden="true">›</span>
        </button>
        <button class="topic-delete" type="button" data-action="delete-topic" data-topic-id="${escapeHtml(topic.id)}" aria-label="Delete ${escapeHtml(topic.title)}" title="Delete ${escapeHtml(topic.title)}">×</button>
      </div>`).join("")}</div>
    <div class="empty-path-tags"><span>${topics.length} ${topics.length === 1 ? "topic" : "topics"}</span><i>·</i><span>${sectionCount} sections</span><i>·</i><span>Ready to study</span></div>`;
}

function deleteTopic(topicId) {
  const topic = getTopic(topicId);
  if (!topic || !window.confirm(`Delete “${topic.title}” and its saved notes? This cannot be undone.`)) return;

  topics = topics.filter(item => item.id !== topicId);
  if (activeTopicId === topicId) {
    activeTopicId = null;
    elements.breadcrumb.textContent = "My library";
    closeDialog();
  }
  const saved = persistTopics();
  renderTopics();
  if (saved) showToast(`Deleted “${topic.title}”.`);
}

async function organizeNotes() {
  const notes = elements.textarea.value.trim();
  if (!notes) {
    showToast("Paste in some notes first, and we’ll get started.");
    elements.textarea.focus();
    return;
  }

  const button = elements.organizeButton;
  const buttonLabel = button.querySelector("span");
  button.disabled = true;
  buttonLabel.textContent = aiAvailable ? "Finding the shape…" : "Organizing locally…";
  button.setAttribute("aria-busy", "true");
  let newTopics = [];
  let mode = "local";
  let aiError = "";
  try {
    if (aiAvailable) {
      try {
        const result = await requestApi("organize", { notes, ...getProfile() });
        newTopics = createAiTopics(result.topics || [], "AI · source notes");
        if (newTopics.length) mode = "AI";
      } catch (error) {
        aiError = error.message || "The AI request failed.";
      }
    }
    if (!newTopics.length) {
      mode = "local";
      const sections = splitIntoSections(notes);
      if (!sections.length) throw new Error("We couldn’t find any note text to organize.");
      newTopics = makeTopicGroups(sections, notes);
      newTopics.forEach(topic => { topic.sourceMode = "Local demo"; });
    }
    topics.push(...newTopics);
    activeTopicId = newTopics[0]?.id || null;
    persistTopics();
    renderTopics();
    const sectionCount = newTopics.reduce((sum, topic) => sum + topic.sections.length, 0);
    const message = `${newTopics.length} ${newTopics.length === 1 ? "topic" : "topics"} organized into ${sectionCount} ${sectionCount === 1 ? "section" : "sections"} · ${mode === "AI" ? "AI, grounded in your notes" : "local demo"}.${aiError ? ` AI error: ${aiError}` : ""}`;
    showToast(message, aiError ? 12000 : 3200);
  } catch (error) {
    showToast(error.message || "We couldn’t organize those notes.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    buttonLabel.textContent = "Build my study guide";
  }
}

function getTopic(topicId) {
  return topics.find(topic => topic.id === topicId);
}

function openDialog() {
  if (!elements.dialog.open) elements.dialog.showModal();
}

function closeDialog() {
  elements.dialogContent.onclick = null;
  elements.dialogContent.onsubmit = null;
  if (elements.dialog.open) elements.dialog.close();
}

function dialogFrame(kicker, content) {
  return `<div class="dialog-inner">
    <div class="dialog-top"><span class="dialog-kicker">${escapeHtml(kicker)}</span><button class="dialog-close" type="button" aria-label="Close dialog">×</button></div>
    ${content}
  </div>`;
}

function studentProfileFromForm(form) {
  const preset = form.elements.preset.value;
  return {
    firstName: form.elements.firstName.value.trim(),
    degree: form.elements.degree.value.trim(),
    studyGoal: form.elements.studyGoal.value.trim(),
    preset: Object.prototype.hasOwnProperty.call(STUDY_PRESETS, preset) ? preset : ""
  };
}

function saveStudentProfile(profile) {
  try {
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
    studentProfile = profile;
    renderStudentProfile();
    return true;
  } catch (error) {
    console.error("Could not save the student profile.", error);
    showToast("Could not save your student profile in this browser.");
    return false;
  }
}

function openStudentProfile() {
  const presetButtons = Object.entries(STUDY_PRESETS).map(([id, preset]) => `
    <button class="study-preset${studentProfile.preset === id ? " selected" : ""}" type="button" data-study-preset="${id}" aria-pressed="${studentProfile.preset === id}">${preset.label}</button>`).join("");
  elements.dialogContent.innerHTML = dialogFrame("STUDENT PROFILE", `
    <h2>Make this study space yours.</h2>
    <p class="dialog-subtitle">No account needed. Your profile and notes stay in this browser unless you choose to export them.</p>
    <form id="student-profile-form">
      <div class="student-profile-grid">
        <label>First name<input name="firstName" type="text" maxlength="60" autocomplete="given-name" placeholder="e.g. Alex"></label>
        <label>Degree / course<input name="degree" type="text" maxlength="140" placeholder="e.g. BSc Computer Science"></label>
        <label class="student-profile-wide">Current study goal / exam focus<textarea name="studyGoal" rows="3" maxlength="700" placeholder="e.g. Revise operating systems before Friday’s exam"></textarea></label>
      </div>
      <input name="preset" type="hidden">
      <div class="preset-heading">Quick study presets</div>
      <div class="study-preset-grid">${presetButtons}</div>
      <div class="workspace-backup-actions">
        <button class="button button-secondary" type="button" data-action="export-workspace">Export workspace backup (.json)</button>
        <button class="button button-secondary" type="button" data-action="import-workspace">Import workspace backup (.json)</button>
      </div>
      <div class="dialog-actions">
        <button class="button button-primary" type="submit">Save student profile</button>
      </div>
    </form>`);

  const form = elements.dialogContent.querySelector("#student-profile-form");
  form.elements.firstName.value = studentProfile.firstName;
  form.elements.degree.value = studentProfile.degree;
  form.elements.studyGoal.value = studentProfile.studyGoal;
  form.elements.preset.value = studentProfile.preset;
  form.elements.studyGoal.addEventListener("input", () => {
    form.elements.preset.value = "";
    form.querySelectorAll("[data-study-preset]").forEach(button => {
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    });
  });
  elements.dialogContent.onsubmit = event => {
    if (!event.target.matches("#student-profile-form")) return;
    event.preventDefault();
    if (saveStudentProfile(studentProfileFromForm(form))) {
      closeDialog();
      showToast("Student profile saved.");
    }
  };
  openDialog();
}

function applyStudyPreset(presetId) {
  if (!Object.prototype.hasOwnProperty.call(STUDY_PRESETS, presetId)) return;
  const form = elements.dialogContent.querySelector("#student-profile-form");
  if (!form) return;
  form.elements.studyGoal.value = STUDY_PRESETS[presetId].goal;
  form.elements.preset.value = presetId;
  form.querySelectorAll("[data-study-preset]").forEach(button => {
    const selected = button.dataset.studyPreset === presetId;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (saveStudentProfile(studentProfileFromForm(form))) {
    showToast(`${STUDY_PRESETS[presetId].label} preset applied.`);
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeFilename(value) {
  return (value || "studyflow").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().slice(0, 100) || "studyflow";
}

function exportWorkspaceBackup() {
  try {
    const form = elements.dialogContent.querySelector("#student-profile-form");
    const backup = {
      format: "studyflow-workspace",
      version: 1,
      exportedAt: new Date().toISOString(),
      topics,
      courseProfile: getCourseProfile(),
      studentProfile: form ? studentProfileFromForm(form) : studentProfile
    };
    downloadFile(`studyflow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
    showToast("Workspace backup downloaded.");
  } catch (error) {
    console.error("Could not export the Studyflow workspace.", error);
    showToast("Could not create the workspace backup.");
  }
}

function normalizeBackupProfile(value, fields, label) {
  if (value == null) value = {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`The ${label} in this backup is invalid.`);
  return fields.reduce((profile, field) => {
    const fieldValue = value[field];
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new Error(`The ${label} field “${field}” must be text.`);
    }
    profile[field] = fieldValue || "";
    return profile;
  }, {});
}

function normalizeBackup(value) {
  if (!value || value.format !== "studyflow-workspace" || value.version !== 1) {
    throw new Error("This is not a supported Studyflow workspace backup.");
  }
  if (!Array.isArray(value.topics)) throw new Error("The backup does not contain a valid topic list.");
  const seenIds = new Set();
  const importedTopics = value.topics.map((topic, topicIndex) => {
    if (!topic || typeof topic.id !== "string" || !topic.id || seenIds.has(topic.id) ||
      typeof topic.title !== "string" || !Array.isArray(topic.sections)) {
      throw new Error(`Topic ${topicIndex + 1} in this backup is invalid.`);
    }
    seenIds.add(topic.id);
    const sections = topic.sections.map((section, sectionIndex) => {
      if (!section || typeof section.title !== "string" || typeof section.text !== "string") {
        throw new Error(`Section ${sectionIndex + 1} in “${topic.title}” is invalid.`);
      }
      if (section.keyPoints !== undefined && (!Array.isArray(section.keyPoints) || section.keyPoints.some(point => typeof point !== "string"))) {
        throw new Error(`Key points in “${section.title}” must be a list of text.`);
      }
      return {
        id: typeof section.id === "string" ? section.id : `${topic.id}-${sectionIndex}`,
        title: section.title,
        text: section.text,
        keyPoints: section.keyPoints || []
      };
    });
    if (!sections.length) throw new Error(`Topic “${topic.title}” has no sections.`);
    return {
      id: topic.id,
      title: topic.title,
      category: typeof topic.category === "string" ? topic.category : "Your notes",
      color: PALETTE[topicIndex % PALETTE.length],
      createdAt: typeof topic.createdAt === "string" ? topic.createdAt : new Date().toISOString(),
      sourceMode: typeof topic.sourceMode === "string" ? topic.sourceMode : "Imported notes",
      sections
    };
  });
  const courseProfile = normalizeBackupProfile(value.courseProfile, ["institution", "course", "level", "assessmentType", "rubric", "pastPaper"], "course profile");
  const studentProfile = normalizeBackupProfile(value.studentProfile, ["firstName", "degree", "studyGoal", "preset"], "student profile");
  if (studentProfile.preset && !Object.prototype.hasOwnProperty.call(STUDY_PRESETS, studentProfile.preset)) {
    throw new Error("The student profile uses an unknown study preset.");
  }
  return { topics: importedTopics, courseProfile, studentProfile };
}

async function importWorkspaceBackup(file) {
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("Workspace backups must be smaller than 20 MB.");
    const backup = normalizeBackup(JSON.parse(await file.text()));
    if (!window.confirm("Importing this backup replaces the topics and profiles saved in this browser. Continue?")) return;

    const records = [
      [STORAGE_KEY, JSON.stringify(backup.topics)],
      [PROFILE_KEY, JSON.stringify(backup.courseProfile)],
      [STUDENT_PROFILE_KEY, JSON.stringify(backup.studentProfile)]
    ];
    const previous = records.map(([key]) => [key, localStorage.getItem(key)]);
    try {
      records.forEach(([key, data]) => localStorage.setItem(key, data));
    } catch (error) {
      previous.forEach(([key, data]) => {
        try {
          if (data === null) localStorage.removeItem(key);
          else localStorage.setItem(key, data);
        } catch (restoreError) {
          console.error(`Could not restore ${key} after a failed workspace import.`, restoreError);
        }
      });
      throw error;
    }

    topics = backup.topics;
    studentProfile = backup.studentProfile;
    activeTopicId = null;
    loadProfile();
    renderStudentProfile();
    renderTopics();
    elements.breadcrumb.textContent = "My library";
    closeDialog();
    showToast("Workspace backup imported.");
  } catch (error) {
    console.error("Could not import the Studyflow workspace.", error);
    showToast(error.message || "Could not import this workspace backup.");
  } finally {
    elements.workspaceImportFile.value = "";
  }
}

function downloadStudySheet(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  const course = studentProfile.degree || getCourseProfile().course;
  const lines = [
    `# ${topic.title}`,
    "",
    course ? `**Course:** ${course}` : "",
    studentProfile.studyGoal ? `**Study goal:** ${studentProfile.studyGoal}` : "",
    `**Sections:** ${topic.sections.length}`,
    "",
    ...topic.sections.flatMap(section => [
      `## ${section.title}`,
      "",
      section.text,
      "",
      ...(section.keyPoints?.length ? ["### Key points", "", ...section.keyPoints.map(point => `- ${point}`), ""] : [])
    ])
  ];
  downloadFile(`${safeFilename(topic.title)}-study-sheet.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  showToast("Study sheet downloaded.");
}

function openTopic(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  elements.dialogContent.onclick = null;
  elements.dialogContent.onsubmit = null;
  activeTopicId = topic.id;
  renderTopics();
  elements.breadcrumb.textContent = topic.title;
  const sectionMarkup = topic.sections.map(section => `
    <div class="lesson-label">${escapeHtml(section.title.toUpperCase())}</div>
    <div class="lesson-block">${escapeHtml(section.text)}</div>
    ${section.keyPoints?.length ? `<ul class="lesson-list">${section.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}`).join("");
  elements.dialogContent.innerHTML = dialogFrame("YOUR NOTES, MADE EASIER TO FOLLOW", `
    <h2>${escapeHtml(topic.title)}</h2>
    <p class="dialog-subtitle">A guided walkthrough using the notes you shared. Take it section by section, and come back to anything that needs another look. <span class="source-pill">Source: ${escapeHtml(topic.sourceMode || "your saved notes")}</span></p>
    ${sectionMarkup}
    <div class="dialog-actions">
      <button class="button button-secondary" type="button" data-action="explain" data-topic-id="${escapeHtml(topic.id)}">Explain a key idea</button>
      <button class="button button-secondary" type="button" data-action="chat" data-topic-id="${escapeHtml(topic.id)}">Ask the tutor</button>
      <button class="button button-secondary" type="button" data-action="flashcards" data-topic-id="${escapeHtml(topic.id)}">Practice flashcards</button>
      <button class="button button-secondary" type="button" data-action="download-study-sheet" data-topic-id="${escapeHtml(topic.id)}">Download study sheet (.md)</button>
      <button class="button button-primary" type="button" data-action="quiz" data-topic-id="${escapeHtml(topic.id)}">Check my understanding <span aria-hidden="true">→</span></button>
      <button class="button button-danger" type="button" data-action="delete-topic" data-topic-id="${escapeHtml(topic.id)}">Delete topic</button>
    </div>`);
  openDialog();
}

function localSourceAnswer(topic, prompt) {
  const terms = prompt.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3);
  const matches = topic.sections.map(section => ({
    section,
    score: terms.reduce((score, term) => score + ((section.title + " " + section.text).toLowerCase().includes(term) ? 1 : 0), 0)
  })).filter(item => item.score).sort((left, right) => right.score - left.score).slice(0, 2);
  if (!matches.length) {
    return "I can’t find enough information about that in the notes you shared. Add a relevant source section and I can help connect the ideas.";
  }
  return `Here’s what your notes say:\n\n${matches.map(item => `${item.section.title}: ${item.section.keyPoints?.slice(0, 2).join(" ") || item.section.text.slice(0, 600)}`).join("\n\n")}\n\nI’m keeping this answer within your source material.`;
}

async function explainTopic(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  elements.dialogContent.onclick = null;
  elements.dialogContent.onsubmit = null;
  elements.dialogContent.innerHTML = dialogFrame("SOURCE-GROUNDED EXPLANATION", `
    <h2>Let’s make it clearer.</h2>
    <p class="dialog-subtitle">A guided explanation of ${escapeHtml(topic.title)}, using only the material in this topic.</p>
    <div class="tutor-answer" id="tutor-answer" aria-live="polite"><span class="loading-dots">Preparing an explanation…</span></div>
    <div class="source-caption">Source: ${escapeHtml(topic.sections.map(section => section.title).join(", "))}</div>`);
  openDialog();
  const sections = topic.sections.map(section => ({ title: section.title }));
  try {
    let answer;
    if (aiAvailable) {
      try {
        const result = await requestApi("explain", {
          topic: topic.title,
          context: topicContext(topic),
          sections,
          ...getProfile()
        });
        answer = result.answer;
      } catch (error) {
        answer = `${localSourceAnswer(topic, topic.title)}\n\n(Local demo answer — AI is unavailable.)`;
        showToast(`Using local source notes: ${error.message}`);
      }
    } else {
      answer = `${localSourceAnswer(topic, topic.title)}\n\n(Local demo answer — AI is not configured.)`;
    }
    const output = elements.dialogContent.querySelector("#tutor-answer");
    if (output) output.textContent = answer;
  } catch (_error) {
    showToast("Could not prepare an explanation from these notes.");
  }
}

function openChat(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  elements.dialogContent.onclick = null;
  const history = [];
  const render = (busy = false) => {
    elements.dialogContent.innerHTML = dialogFrame("ASK YOUR SOURCE-GROUNDED TUTOR", `
      <h2>Curious about something?</h2>
      <p class="dialog-subtitle">Ask a follow-up. Answers use only the notes in <strong>${escapeHtml(topic.title)}</strong>.</p>
      <div class="chat-thread" id="chat-thread" aria-live="polite">${history.length ? history.map(item => `
        <div class="chat-message ${item.role === "user" ? "from-user" : "from-tutor"}">
          <span>${item.role === "user" ? "YOU" : "TUTOR · YOUR NOTES"}</span><p>${escapeHtml(item.text)}</p>
        </div>`).join("") : '<p class="chat-empty">Your conversation will appear here. If the notes don’t contain an answer, the tutor will say so.</p>'}
        ${busy ? '<div class="chat-message from-tutor"><span>TUTOR</span><p class="loading-dots">Thinking from your notes…</p></div>' : ""}</div>
      <form class="chat-form" id="chat-form">
        <label class="sr-only" for="chat-question">Ask a question about your notes</label>
        <input id="chat-question" name="question" maxlength="2000" placeholder="Ask a question about this topic…" required ${busy ? "disabled" : ""}>
        <button class="button button-primary" type="submit" ${busy ? "disabled" : ""}>Send</button>
      </form>
      <div class="source-caption">Source material: ${escapeHtml(topic.sections.map(section => section.title).join(", "))}</div>`);
    const thread = elements.dialogContent.querySelector("#chat-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  };
  render();
  openDialog();
  elements.dialogContent.onsubmit = async event => {
    if (!event.target.matches("#chat-form")) return;
    event.preventDefault();
    const input = event.target.elements.question;
    const question = input.value.trim();
    if (!question) return;
    history.push({ role: "user", text: question });
    render(true);
    try {
      let answer;
      if (aiAvailable) {
        try {
          const result = await requestApi("chat", {
            question,
            history: history.slice(0, -1),
            context: topicContext(topic),
            ...getProfile()
          });
          answer = result.answer;
        } catch (error) {
          answer = `${localSourceAnswer(topic, question)}\n\n(Local demo answer — AI is unavailable.)\n\nAI request error: ${error.message}`;
          showToast(`Using local source notes: ${error.message}`);
        }
      } else {
        answer = `${localSourceAnswer(topic, question)}\n\n(Local demo answer — AI is not configured.)`;
      }
      history.push({ role: "assistant", text: answer });
    } catch (_error) {
      history.push({ role: "assistant", text: "I couldn’t prepare a response. Please try again." });
    }
    render();
    const nextInput = elements.dialogContent.querySelector("#chat-question");
    if (nextInput) nextInput.focus();
  };
}

function makeFlashcards(topic) {
  return topic.sections.map(section => {
    const definition = section.text.match(/^\s*([^:\n]{2,70}):\s*(.+)$/s);
    return definition
      ? { front: definition[1].trim(), back: definition[2].trim() }
      : { front: `What should you remember about “${section.title}”?`, back: section.keyPoints?.join("\n") || section.text };
  });
}

function openFlashcards(topicId) {
  const topic = getTopic(topicId);
  if (!topic || !topic.sections.length) return;
  elements.dialogContent.onsubmit = null;
  const cards = makeFlashcards(topic);
  let current = 0;
  let flipped = false;

  const render = () => {
    const card = cards[current];
    elements.dialogContent.innerHTML = dialogFrame(`FLASHCARDS · ${escapeHtml(topic.title.toUpperCase())}`, `
      <h2>One idea at a time.</h2>
      <p class="dialog-subtitle">Tap the card to reveal what your notes say.</p>
      <button class="flashcard" type="button" aria-label="${flipped ? "Show prompt" : "Reveal answer"}">
        <span class="flash-label">${flipped ? "YOUR NOTES" : "PROMPT"} · ${current + 1} OF ${cards.length}</span>
        <p>${escapeHtml(flipped ? card.back : card.front).replace(/\n/g, "<br>")}</p>
        <span class="flash-hint">Click to ${flipped ? "see the prompt" : "reveal the answer"}</span>
      </button>
      <div class="dialog-actions">
        <button class="button button-secondary" type="button" data-action="flash-prev">← Previous</button>
        <button class="button button-primary" type="button" data-action="flash-next">${current === cards.length - 1 ? "Start again" : "Next card"} <span aria-hidden="true">→</span></button>
      </div>`);
  };

  elements.dialogContent.onclick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.classList.contains("flashcard")) {
      flipped = !flipped;
      render();
    } else if (button.dataset.action === "flash-next") {
      current = (current + 1) % cards.length;
      flipped = false;
      render();
    } else if (button.dataset.action === "flash-prev") {
      current = (current - 1 + cards.length) % cards.length;
      flipped = false;
      render();
    }
  };

  render();
  openDialog();
}

function quizFacts(topic) {
  return topic.sections.flatMap(section => (section.keyPoints || [section.text])
    .map(point => point.replace(/\s+/g, " ").trim())
    .filter(point => point.length > 12)
    .map(point => ({ sectionTitle: section.title, text: point })));
}

async function openQuiz(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  elements.dialogContent.onsubmit = null;
  let questions = [];
  let usedAi = false;
  if (aiAvailable) {
    elements.dialogContent.innerHTML = dialogFrame("SOURCE-GROUNDED QUIZ", `<h2>Making a quick check…</h2><p class="dialog-subtitle loading-dots">Building questions from your notes.</p>`);
    openDialog();
    try {
      const result = await requestApi("quiz", { topic: topic.title, context: topicContext(topic), ...getProfile() });
      questions = result.questions || [];
      usedAi = questions.length > 0;
      if (!usedAi) {
        showToast("AI returned no usable questions. Making a local quiz from your notes.");
      }
    } catch (error) {
      showToast(`AI quiz unavailable (${error.message}). Making a local quiz from your notes.`);
    }
  }
  if (!questions.length) {
    const facts = quizFacts(topic);
    questions = facts.map((fact, index) => {
      const distractors = facts.filter((_, factIndex) => factIndex !== index)
        .map(item => item.text)
        .filter((text, optionIndex, list) => text !== fact.text && list.indexOf(text) === optionIndex)
        .slice(0, 3);
      const placeholders = ["This detail isn’t included in the notes you shared.", "The notes do not state this.", "This was not mentioned in the source."];
      while (distractors.length < 3) distractors.push(placeholders[distractors.length]);
      const options = [fact.text, ...distractors.slice(0, 3)].sort((left, right) => left.localeCompare(right));
      return {
        question: `Which detail appears in your notes about ${fact.sectionTitle}?`,
        options,
        answerIndex: options.indexOf(fact.text),
        explanation: `Your notes say: ${fact.text}`,
        source: fact.sectionTitle
      };
    });
  }
  if (!questions.length) {
    showToast("There isn’t enough note text here to make a quiz.");
    return;
  }
  let current = 0;
  let score = 0;
  let answered = false;

  const render = () => {
    if (current >= questions.length) {
      elements.dialogContent.innerHTML = dialogFrame("QUICK CHECK", `
        <h2>You made it through.</h2>
        <p class="dialog-subtitle">You got ${score} out of ${questions.length} from ${escapeHtml(topic.title)}. Every pass helps the ideas settle in. ${escapeHtml(usedAi ? "AI questions grounded in your notes." : "Local demo quiz, grounded in your notes.")}</p>
        <div class="dialog-actions"><button class="button button-secondary" type="button" data-action="quiz-restart">Try again</button><button class="button button-primary" type="button" data-action="quiz-close">Done</button></div>`);
      return;
    }
    const question = questions[current];
    elements.dialogContent.innerHTML = dialogFrame(`QUICK CHECK · ${escapeHtml(topic.title.toUpperCase())}`, `
      <div class="quiz-progress">QUESTION ${current + 1} OF ${questions.length}</div>
      <h2 class="quiz-question">${escapeHtml(question.question)}</h2>
      <div class="quiz-options">${question.options.map((option, index) => `
        <button class="quiz-option" type="button" data-action="quiz-answer" data-correct="${index === question.answerIndex}" data-index="${index}">${escapeHtml(option)}</button>`).join("")}</div>
      <div class="quiz-feedback" aria-live="polite"></div>
      <div class="dialog-actions"><span class="quiz-progress">Score: ${score}</span><button class="button button-primary" type="button" data-action="quiz-next" disabled>${current === questions.length - 1 ? "See results" : "Next question"} <span aria-hidden="true">→</span></button></div>`);
  };

  elements.dialogContent.onclick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "quiz-answer" && !answered) {
      answered = true;
      const isCorrect = button.dataset.correct === "true";
      if (isCorrect) score += 1;
      elements.dialogContent.querySelectorAll(".quiz-option").forEach(option => {
        option.disabled = true;
        if (option.dataset.correct === "true") option.classList.add("correct");
      });
      if (!isCorrect) button.classList.add("incorrect");
      const currentQuestion = questions[current];
      elements.dialogContent.querySelector(".quiz-feedback").textContent = `${isCorrect ? "That’s right. " : "Not quite. "}${currentQuestion.explanation || "The highlighted option is supported by your notes."}${currentQuestion.source ? ` Source: ${currentQuestion.source}.` : ""}`;
      elements.dialogContent.querySelector('[data-action="quiz-next"]').disabled = false;
    } else if (button.dataset.action === "quiz-next") {
      current += 1;
      answered = false;
      render();
    } else if (button.dataset.action === "quiz-restart") {
      current = 0;
      score = 0;
      answered = false;
      render();
    } else if (button.dataset.action === "quiz-close") {
      closeDialog();
    }
  };

  render();
  openDialog();
}

function openStudyMode() {
  if (!topics.length) {
    showToast("Organize some notes first, then your study session will be ready.");
    elements.textarea.focus();
    return;
  }
  const topic = topics[topics.length - 1];
  elements.dialogContent.onsubmit = null;
  elements.dialogContent.innerHTML = dialogFrame("STUDY MODE", `
    <h2>How would you like to study?</h2>
    <p class="dialog-subtitle">Pick a path through ${escapeHtml(topic.title)}. You can switch things up whenever you like.</p>
    <div class="dialog-actions">
      <button class="button button-secondary" type="button" data-action="study-lesson" data-topic-id="${escapeHtml(topic.id)}">Walk me through it</button>
      <button class="button button-secondary" type="button" data-action="flashcards" data-topic-id="${escapeHtml(topic.id)}">Flashcards</button>
      <button class="button button-primary" type="button" data-action="quiz" data-topic-id="${escapeHtml(topic.id)}">Quick quiz</button>
    </div>`);
  openDialog();
}

function fillSample() {
  elements.textarea.value = `Cell Structure and Function

The cell membrane controls what enters and leaves the cell. It is selectively permeable, so some substances pass through while others are blocked.

Organelles
The nucleus contains DNA and controls many of the cell's activities. Mitochondria release usable energy through cellular respiration. Ribosomes build proteins.

Plant Cells
Chloroplasts capture light energy for photosynthesis. The cell wall provides extra support and protection. A large central vacuole stores water and helps keep the cell firm.

Remember: plant and animal cells share structures such as a nucleus, cell membrane, and mitochondria. Plant cells also have a cell wall, chloroplasts, and a large central vacuole.`;
  updateWordCount();
  organizeNotes();
}

elements.textarea.addEventListener("input", updateWordCount);
elements.organizeButton.addEventListener("click", organizeNotes);
elements.sampleButton.addEventListener("click", fillSample);
document.querySelector("#add-topic").addEventListener("click", () => {
  elements.textarea.focus();
  elements.textarea.scrollIntoView({ behavior: "smooth", block: "center" });
});
document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link === button));
    if (button.dataset.view === "study") {
      elements.breadcrumb.textContent = "Study mode";
      openStudyMode();
    } else {
      elements.breadcrumb.textContent = "My library";
      closeDialog();
    }
  });
});
elements.topicNav.addEventListener("click", event => {
  const deleteButton = event.target.closest('[data-action="delete-topic"]');
  if (deleteButton) {
    deleteTopic(deleteButton.dataset.topicId);
    return;
  }
  const button = event.target.closest(".topic-link[data-topic-id]");
  if (button) openTopic(button.dataset.topicId);
});
elements.pathContent.addEventListener("click", event => {
  const deleteButton = event.target.closest('[data-action="delete-topic"]');
  if (deleteButton) {
    deleteTopic(deleteButton.dataset.topicId);
    return;
  }
  const button = event.target.closest(".path-topic-open[data-topic-id]");
  if (button) openTopic(button.dataset.topicId);
});
elements.dialogContent.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.classList.contains("dialog-close")) {
    closeDialog();
    return;
  }
  if (button.dataset.action === "delete-topic") {
    deleteTopic(button.dataset.topicId);
    return;
  }
  if (button.dataset.action === "download-study-sheet") {
    downloadStudySheet(button.dataset.topicId);
    return;
  }
  if (button.dataset.action === "export-workspace") {
    exportWorkspaceBackup();
    return;
  }
  if (button.dataset.action === "import-workspace") {
    elements.workspaceImportFile.click();
    return;
  }
  if (button.dataset.studyPreset) {
    applyStudyPreset(button.dataset.studyPreset);
    return;
  }
  if (button.dataset.action === "flashcards") openFlashcards(button.dataset.topicId);
  if (button.dataset.action === "quiz") openQuiz(button.dataset.topicId);
  if (button.dataset.action === "study-lesson") openTopic(button.dataset.topicId);
  if (button.dataset.action === "explain") explainTopic(button.dataset.topicId);
  if (button.dataset.action === "chat") openChat(button.dataset.topicId);
});
elements.dialog.addEventListener("click", event => {
  if (event.target === elements.dialog) closeDialog();
});

function updateWordCount() {
  elements.wordCount.textContent = formatWordCount(countWords(elements.textarea.value));
}

function showUploadMetadata(filename, metadata) {
  elements.uploadMeta.hidden = false;
  elements.uploadMeta.innerHTML = `<span class="upload-file-check" aria-hidden="true">✓</span><strong>${escapeHtml(filename)}</strong><span>${metadata.words.toLocaleString()} words · ${metadata.type}${metadata.pages ? ` · ${metadata.pages} pages` : ""}${metadata.truncated ? " · text shortened to fit" : ""}</span><button type="button" class="upload-remove" aria-label="Dismiss uploaded file">×</button>`;
}

async function handleUpload(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    showToast("That file is over the 12 MB upload limit.");
    return;
  }
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "txt", "docx", "md"].includes(extension)) {
    showToast("Choose a PDF, DOCX, TXT, or Markdown file.");
    return;
  }
  elements.uploadZone.classList.add("is-loading");
  elements.uploadZone.setAttribute("aria-busy", "true");
  try {
    let text = "";
    let metadata = { type: extension.toUpperCase(), words: 0 };
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The server could not read this file.");
      text = result.text;
      metadata = result.metadata;
      uploadName = result.filename;
    } catch (error) {
      if (extension !== "txt" && extension !== "md") {
        throw new Error(`PDF and DOCX extraction needs the Studyflow server. ${error.message}`);
      }
      text = await file.text();
      metadata.words = countWords(text);
      uploadName = file.name;
      setMode(false, "Local demo mode · server unavailable");
      showToast("Text file read in local demo mode. PDF/DOCX extraction needs the server.");
    }
    if (!text.trim()) throw new Error("No readable text was found in that file.");
    if (text.length > 60000) {
      text = text.slice(0, 60000);
      metadata.truncated = true;
    }
    metadata.words = countWords(text);
    elements.textarea.value = text;
    updateWordCount();
    showUploadMetadata(uploadName, metadata);
    elements.textarea.focus();
    showToast(`${uploadName} is ready. Review the extracted text, then organize your notes.`);
  } catch (error) {
    showToast(error.message || "Could not read that file.");
  } finally {
    elements.uploadZone.classList.remove("is-loading");
    elements.uploadZone.removeAttribute("aria-busy");
    elements.fileInput.value = "";
  }
}

function bindUpload() {
  const chooseFile = document.querySelector("#choose-file");
  chooseFile.addEventListener("click", event => {
    event.stopPropagation();
    elements.fileInput.click();
  });
  elements.uploadZone.addEventListener("click", event => {
    if (event.target.closest(".upload-remove")) {
      elements.uploadMeta.hidden = true;
      uploadName = "";
      return;
    }
    if (!event.target.closest("button")) elements.fileInput.click();
  });
  elements.uploadZone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
  elements.fileInput.addEventListener("change", () => handleUpload(elements.fileInput.files[0]));
  ["dragenter", "dragover"].forEach(type => elements.uploadZone.addEventListener(type, event => {
    event.preventDefault();
    elements.uploadZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach(type => elements.uploadZone.addEventListener(type, event => {
    event.preventDefault();
    elements.uploadZone.classList.remove("is-dragging");
  }));
  elements.uploadZone.addEventListener("drop", event => handleUpload(event.dataTransfer.files[0]));
  elements.uploadMeta.addEventListener("click", event => {
    if (!event.target.closest(".upload-remove")) return;
    elements.uploadMeta.hidden = true;
    uploadName = "";
  });
}

function bindProfile() {
  loadProfile();
  document.querySelectorAll(".profile-grid input, .profile-grid select, .profile-grid textarea").forEach(field => {
    field.addEventListener("input", () => {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(getProfile()));
      } catch (_error) {
        showToast("Study profile could not be saved in this browser.");
      }
    });
    field.addEventListener("change", () => {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(getProfile()));
      } catch (_error) {
        showToast("Study profile could not be saved in this browser.");
      }
    });
  });
}

bindUpload();
bindProfile();
elements.studentProfileButton.addEventListener("click", openStudentProfile);
elements.workspaceImportFile.addEventListener("change", () => importWorkspaceBackup(elements.workspaceImportFile.files[0]));
checkApiStatus();
renderTopics();
renderStudentProfile();
updateWordCount();
