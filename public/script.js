"use strict";

const LEGACY_STORAGE_KEY = "studyflow.topics.v1";
const MODULES_STORAGE_KEY = "studyflow.modules.v2";
const PROFILE_KEY = "studyflow.profile.v1";
const STUDENT_PROFILE_KEY = "studyflow.student-profile.v1";

const PALETTE = [
  { background: "#edf4ee", color: "#5b8b65", dot: "#79a984" },
  { background: "#f2eff8", color: "#8873ac", dot: "#a18bc7" },
  { background: "#fbf1e9", color: "#bd8158", dot: "#d19a72" },
  { background: "#eef2f8", color: "#6d83a4", dot: "#8da2bf" },
  { background: "#f8eff1", color: "#a47481", dot: "#c48d9b" }
];

const STUDY_PRESETS = {
  "exam-cram": {
    label: "Exam Cram",
    goal: "Prioritize high-yield concepts, common misconceptions, and exam-style retrieval practice."
  },
  "lecture-summary": {
    label: "Deep Concept Mastery",
    goal: "Build thorough conceptual understanding with worked examples and clear explanations."
  },
  "past-paper-prep": {
    label: "Past-Paper Prep",
    goal: "Focus on exam-style questions, marking criteria, and application grounded in course notes."
  },
  "assignment-rubric": {
    label: "Assignment Rubric",
    goal: "Organize concepts around the assignment rubric and highlight relevant evidence in my notes."
  }
};

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

let modules = loadModules();
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
  } catch (_error) {
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

function allTopics() {
  return modules.flatMap(mod => (mod.topics || []).map(topic => ({ ...topic, moduleMeta: mod })));
}

function findTopicEntry(topicId) {
  for (const mod of modules) {
    const topic = (mod.topics || []).find(t => t.id === topicId);
    if (topic) return { module: mod, topic };
  }
  return null;
}

function getTopic(topicId) {
  const entry = findTopicEntry(topicId);
  if (!entry) return null;
  return { ...entry.topic, moduleMeta: entry.module };
}

function topicContext(topic) {
  return (topic.sections || []).map(section => `SECTION: ${section.title}\n${section.text}`).join("\n\n");
}

function createDefaultMastery() {
  return {
    state: "Not started",
    lessonCompleted: false,
    attempts: 0,
    correct: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    lastReviewDate: null,
    nextReviewDate: null,
    weakAreas: []
  };
}

function loadModules() {
  try {
    const savedV2 = localStorage.getItem(MODULES_STORAGE_KEY);
    if (savedV2) {
      const parsed = JSON.parse(savedV2);
      if (Array.isArray(parsed)) {
        return parsed.filter(m => m && typeof m.id === "string" && Array.isArray(m.topics));
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyTopics = JSON.parse(legacyRaw);
      if (Array.isArray(legacyTopics) && legacyTopics.length) {
        const migratedModule = {
          id: `mod-migrated-${Date.now()}`,
          name: legacyTopics[0]?.module?.name || "Imported Study Notes",
          discipline: legacyTopics[0]?.module?.discipline || "General Academic",
          knowledgeTypes: ["Conceptual", "Applied"],
          learningOutcomes: [],
          prerequisites: [],
          topicRelationships: "",
          gapsAndAmbiguities: [],
          createdAt: new Date().toISOString(),
          sourceMode: "Migrated v1",
          topics: legacyTopics.map((t, idx) => ({
            id: t.id || `top-${Date.now()}-${idx}`,
            title: t.title || `Topic ${idx + 1}`,
            order: idx + 1,
            subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
            prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites : [],
            knowledgeTypes: ["Conceptual"],
            sourceReferences: Array.isArray(t.sourceReferences) ? t.sourceReferences : (t.sections || []).map(s => s.title),
            color: t.color || PALETTE[idx % PALETTE.length],
            sourceMode: t.sourceMode || "Saved notes",
            sections: Array.isArray(t.sections) ? t.sections : [],
            lesson: null,
            flashcards: [],
            questionBank: [],
            mastery: createDefaultMastery()
          }))
        };
        const initial = [migratedModule];
        localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
    }
    return [];
  } catch (error) {
    console.error("Could not load saved Studyflow modules.", error);
    return [];
  }
}

function persistModules() {
  try {
    localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(modules));
    elements.savedStatus.innerHTML = '<span class="status-dot"></span> All changes saved';
    return true;
  } catch (error) {
    console.error("Could not save Studyflow modules.", error);
    elements.savedStatus.textContent = "Could not save changes";
    showToast("Could not save notes on this device. Check browser storage space.");
    return false;
  }
}

function createLocalModuleFallback(notes, sections) {
  const firstTitle = sections[0]?.title || "Submitted Module";
  const courseName = getCourseProfile().course || firstTitle;
  const stamp = Date.now();
  return {
    id: `mod-${stamp}`,
    name: courseName,
    discipline: "General Academic (Local Mode)",
    knowledgeTypes: ["Conceptual", "Applied"],
    learningOutcomes: sections.slice(0, 5).map(s => `Understand and apply key principles of ${s.title}`),
    prerequisites: [],
    topicRelationships: "Topics are ordered sequentially based on your submitted notes.",
    gapsAndAmbiguities: ["Running in local offline mode: AI analysis is unavailable."],
    createdAt: new Date().toISOString(),
    sourceMode: "Local demo",
    topics: [{
      id: `top-${stamp}-0`,
      title: courseName,
      order: 1,
      subtopics: sections.map(s => s.title),
      prerequisites: [],
      knowledgeTypes: ["Conceptual"],
      sourceReferences: sections.map(s => s.title),
      color: PALETTE[modules.length % PALETTE.length],
      sourceMode: "Local demo",
      sections: sections.map((sec, idx) => ({
        id: `sec-${stamp}-${idx}`,
        title: sec.title,
        text: sec.text,
        keyPoints: getKeyPoints(sec.text)
      })),
      lesson: null,
      flashcards: [],
      questionBank: [],
      mastery: createDefaultMastery()
    }]
  };
}

function createLocalLessonFallback(topic, moduleMeta) {
  const sections = topic.sections || [];
  const allPoints = sections.flatMap(s => s.keyPoints || []).filter(Boolean);
  return {
    teachingApproach: `Structured local walkthrough for ${moduleMeta?.discipline || "academic"} study based directly on your notes.`,
    learningObjectives: allPoints.slice(0, 5).map(p => `Understand and explain: ${p}`),
    introduction: `This lesson covers ${topic.title} within ${moduleMeta?.name || "your module"}.`,
    foundationalKnowledge: topic.prerequisites || [],
    coreConcepts: sections.map(sec => ({
      title: sec.title,
      explanation: sec.text,
      keyTakeaway: (sec.keyPoints && sec.keyPoints[0]) || sec.title
    })),
    terminology: [],
    stepByStepProcesses: [],
    workedExamples: [],
    diagramsTablesCode: [],
    realWorldApplications: [],
    advantagesAndLimitations: { advantages: [], disadvantages: [], limitations: [] },
    comparisons: [],
    commonMisconceptions: [],
    practiceExercises: [],
    examStyleQuestions: [],
    knowledgeChecks: allPoints.slice(0, 4).map(pt => ({
      question: `Explain: "${pt.slice(0, 90)}${pt.length > 90 ? "…" : ""}"`,
      answer: pt
    })),
    recap: allPoints.length ? `Core takeaways: ${allPoints.slice(0, 4).join(" · ")}.` : `Review ${topic.title}.`,
    sourceLimitations: ["Generated in local offline mode without AI synthesis."],
    sourceReferences: sections.map(s => s.title)
  };
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

function formatRichText(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => {
      let safe = escapeHtml(para);
      safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
      safe = safe.replace(/\n/g, "<br>");
      return `<p style="margin: 0 0 0.75rem 0; line-height: 1.65;">${safe}</p>`;
    })
    .join("");
}

function showToast(message, duration = 3400) {
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
  return false;
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

  const paragraphs = notes.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map((text, index) => ({
    title: text.split("\n")[0].slice(0, 50) || `Section ${index + 1}`,
    text
  }));
}

function splitSentences(text) {
  return text.replace(/\r/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);
}

function getKeyPoints(text) {
  const lines = text.split(/\n/).map(cleanLine).filter(Boolean);
  const candidates = lines.length > 1 ? lines : splitSentences(text);
  const points = candidates.map(p => p.replace(/\s+/g, " ").trim()).filter(p => p.length > 8).slice(0, 5);
  return points.length ? points : [text.trim()];
}

function renderTopics() {
  const topicsList = allTopics();
  elements.topicNav.innerHTML = "";
  if (!topicsList.length) {
    elements.topicNav.innerHTML = '<p class="sidebar-empty">Your module topics will show up here.</p>';
  } else {
    topicsList.slice().reverse().forEach(topic => {
      const row = document.createElement("div");
      row.className = "topic-link-row";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = `topic-link${activeTopicId === topic.id ? " selected" : ""}`;
      openButton.dataset.topicId = topic.id;
      const lessonReady = topic.lesson ? " · Lesson ready" : "";
      openButton.innerHTML = `<span class="topic-dot" style="background:${escapeHtml(topic.color?.dot || PALETTE[0].dot)}"></span><span class="topic-link-label">${escapeHtml(topic.title)}<small style="display:block;opacity:0.7;font-size:0.72rem;">${escapeHtml(topic.moduleMeta?.name || "")}${lessonReady}</small></span>`;
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
  elements.topicCount.textContent = String(topicsList.length);
  renderPath();
}

function renderPath() {
  const topicsList = allTopics();
  if (!topicsList.length) {
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
      <p>Submit any academic module or lecture notes. Studyflow identifies the discipline, maps prerequisites, and builds full interactive lessons.</p>
      <div class="empty-path-tags"><span>Dynamic recognition</span><i>·</i><span>Full lessons</span><i>·</i><span>AI Tutor & Cards</span></div>`;
    return;
  }

  const latestModule = modules[modules.length - 1];
  const latestTopic = latestModule.topics[0] || topicsList[topicsList.length - 1];
  const knowledgeBadges = (latestModule.knowledgeTypes || [])
    .map(kt => `<span class="source-pill" style="margin-right:4px;">${escapeHtml(kt)}</span>`)
    .join("");
  const gapsMarkup = (latestModule.gapsAndAmbiguities || []).length
    ? `<div style="margin-top:0.65rem;padding:0.6rem 0.75rem;border-radius:10px;background:#fbf1e9;color:#7a4b2a;font-size:0.82rem;">
        <strong>Detected source gaps:</strong> ${escapeHtml(latestModule.gapsAndAmbiguities.join(" · "))}
       </div>`
    : "";

  elements.pathStatus.classList.add("ready");
  elements.pathStatus.innerHTML = "<span></span> MODULE ANALYSED";
  elements.pathContent.className = "path-content has-topics";
  elements.pathContent.innerHTML = `
    <div class="path-topic-overview" style="flex-direction:column;align-items:flex-start;gap:0.4rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;width:100%;">
        <span class="overview-icon" style="background:${escapeHtml(latestTopic.color.background)};color:${escapeHtml(latestTopic.color.color)}"><svg viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v7H4V5.5ZM14 4h4.5A1.5 1.5 0 0 1 20 5.5V11h-6V4ZM4 15h6v5H5.5A1.5 1.5 0 0 1 4 18.5V15ZM14 14h6v4.5a1.5 1.5 0 0 1-1.5 1.5H14v-6Z"/></svg></span>
        <span>
          <strong>${escapeHtml(latestModule.name)}</strong>
          <small style="display:block;">${escapeHtml(latestModule.discipline)} · ${latestModule.topics.length} ${latestModule.topics.length === 1 ? "topic" : "topics"}</small>
        </span>
      </div>
      <div>${knowledgeBadges}</div>
      ${latestModule.topicRelationships ? `<p style="margin:0.25rem 0 0;font-size:0.84rem;opacity:0.85;">${escapeHtml(latestModule.topicRelationships)}</p>` : ""}
      ${gapsMarkup}
    </div>
    <div class="path-topic-list">${topicsList.slice().reverse().map(topic => `
      <div class="path-topic-row">
        <button class="path-topic-open" type="button" data-topic-id="${escapeHtml(topic.id)}">
          <span class="topic-dot" style="background:${escapeHtml(topic.color?.dot || PALETTE[0].dot)}"></span>
          <strong>${escapeHtml(topic.title)}</strong>
          <small>${topic.lesson ? "Lesson ready" : "Open to generate lesson"} · ${topic.sections.length} src</small>
          <span class="row-arrow" aria-hidden="true">›</span>
        </button>
        <button class="topic-delete" type="button" data-action="delete-topic" data-topic-id="${escapeHtml(topic.id)}" aria-label="Delete ${escapeHtml(topic.title)}" title="Delete ${escapeHtml(topic.title)}">×</button>
      </div>`).join("")}</div>
    <div class="empty-path-tags"><span>${modules.length} ${modules.length === 1 ? "module" : "modules"}</span><i>·</i><span>${topicsList.length} topics</span><i>·</i><span>Click any topic to learn</span></div>`;
}

function deleteTopic(topicId) {
  const entry = findTopicEntry(topicId);
  if (!entry || !window.confirm(`Delete “${entry.topic.title}”? This cannot be undone.`)) return;

  entry.module.topics = entry.module.topics.filter(t => t.id !== topicId);
  modules = modules.filter(m => m.topics.length > 0);
  if (activeTopicId === topicId) {
    activeTopicId = null;
    elements.breadcrumb.textContent = "My library";
    closeDialog();
  }
  const saved = persistModules();
  renderTopics();
  if (saved) showToast(`Deleted “${entry.topic.title}”.`);
}

async function organizeNotes() {
  const notes = elements.textarea.value.trim();
  if (!notes) {
    showToast("Paste in some notes or upload a file first.");
    elements.textarea.focus();
    return;
  }

  const button = elements.organizeButton;
  const buttonLabel = button.querySelector("span");
  button.disabled = true;
  buttonLabel.textContent = aiAvailable ? "Analysing module & syllabus…" : "Organizing locally…";
  button.setAttribute("aria-busy", "true");

  let createdModule = null;
  let mode = "local";
  let aiError = "";

  try {
    if (aiAvailable) {
      try {
        const result = await requestApi("analyze-module", { notes, ...getProfile() });
        const stamp = Date.now();
        const modInfo = result.module || {};
        const baseIdx = allTopics().length;
        createdModule = {
          id: `mod-${stamp}`,
          name: modInfo.name || getCourseProfile().course || "Submitted Module",
          discipline: modInfo.discipline || "General Academic",
          knowledgeTypes: Array.isArray(modInfo.knowledgeTypes) ? modInfo.knowledgeTypes : ["Conceptual"],
          learningOutcomes: Array.isArray(modInfo.learningOutcomes) ? modInfo.learningOutcomes : [],
          prerequisites: Array.isArray(modInfo.prerequisites) ? modInfo.prerequisites : [],
          topicRelationships: modInfo.topicRelationships || "",
          gapsAndAmbiguities: Array.isArray(modInfo.gapsAndAmbiguities) ? modInfo.gapsAndAmbiguities : [],
          createdAt: new Date().toISOString(),
          sourceMode: "AI · Dynamic Analysis",
          topics: (result.topics || []).map((t, idx) => ({
            id: `top-${stamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            title: t.title || `Topic ${idx + 1}`,
            order: t.order || idx + 1,
            subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
            prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites : [],
            knowledgeTypes: Array.isArray(t.knowledgeTypes) ? t.knowledgeTypes : modInfo.knowledgeTypes || [],
            sourceReferences: Array.isArray(t.sourceReferences) ? t.sourceReferences : [],
            color: PALETTE[(baseIdx + idx) % PALETTE.length],
            sourceMode: "AI · Dynamic Analysis",
            sections: (t.sections || []).map((sec, sIdx) => ({
              id: `sec-${stamp}-${idx}-${sIdx}`,
              title: sec.title || `Section ${sIdx + 1}`,
              text: sec.text || "",
              keyPoints: Array.isArray(sec.keyPoints) && sec.keyPoints.length ? sec.keyPoints : getKeyPoints(sec.text || "")
            })).filter(s => s.text),
            lesson: null,
            flashcards: [],
            questionBank: [],
            mastery: createDefaultMastery()
          })).filter(t => t.sections.length)
        };
        if (createdModule.topics.length) mode = "AI";
        else createdModule = null;
      } catch (error) {
        aiError = error.message || "AI module analysis failed.";
      }
    }

    if (!createdModule) {
      mode = "local";
      const sections = splitIntoSections(notes);
      if (!sections.length) throw new Error("We couldn’t find any readable note text to organize.");
      createdModule = createLocalModuleFallback(notes, sections);
    }

    modules.push(createdModule);
    activeTopicId = createdModule.topics[0]?.id || null;
    persistModules();
    renderTopics();

    const count = createdModule.topics.length;
    const msg = mode === "AI"
      ? `Analysed “${createdModule.name}” (${createdModule.discipline}) into ${count} ${count === 1 ? "topic" : "topics"}. Click any topic to open its full lesson.`
      : `Organized locally into ${count} ${count === 1 ? "topic" : "topics"}.${aiError ? ` AI error: ${aiError}` : ""}`;
    showToast(msg, aiError ? 10000 : 4500);
  } catch (error) {
    showToast(error.message || "We couldn’t organize those notes.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    buttonLabel.textContent = "Build my study guide";
  }
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

function renderLessonHtml(topic, lesson) {
  const mod = topic.moduleMeta || {};
  const blocks = [];

  blocks.push(`
    <div class="module-analysis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.65rem;padding:0.85rem;border-radius:12px;background:#f7f8f5;margin-bottom:1.1rem;">
      <div><span style="font-size:0.7rem;letter-spacing:0.06em;opacity:0.7;display:block;">MODULE</span><strong>${escapeHtml(mod.name || "Module")}</strong></div>
      <div><span style="font-size:0.7rem;letter-spacing:0.06em;opacity:0.7;display:block;">DISCIPLINE</span><strong>${escapeHtml(mod.discipline || "General Academic")}</strong></div>
      <div><span style="font-size:0.7rem;letter-spacing:0.06em;opacity:0.7;display:block;">KNOWLEDGE TYPE</span><strong>${escapeHtml((topic.knowledgeTypes || mod.knowledgeTypes || ["Combined"]).join(", "))}</strong></div>
    </div>
  `);

  if (lesson.teachingApproach) {
    blocks.push(`<p style="font-size:0.84rem;font-style:italic;opacity:0.85;margin-bottom:1rem;">Pedagogical focus: ${escapeHtml(lesson.teachingApproach)}</p>`);
  }

  if (lesson.learningObjectives?.length) {
    blocks.push(`<div class="lesson-label">1. LEARNING OBJECTIVES</div><ul class="lesson-list">${lesson.learningObjectives.map(o => `<li>${escapeHtml(o)}</li>`).join("")}</ul>`);
  }

  if (lesson.introduction) {
    blocks.push(`<div class="lesson-label">2. INTRODUCTION & CONTEXT</div><div class="lesson-block">${formatRichText(lesson.introduction)}</div>`);
  }

  const prereqs = [...new Set([...(topic.prerequisites || []), ...(lesson.foundationalKnowledge || [])])];
  if (prereqs.length) {
    blocks.push(`<div class="lesson-label">3. FOUNDATIONAL & PREREQUISITE CONCEPTS</div><ul class="lesson-list">${prereqs.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`);
  }

  if (lesson.coreConcepts?.length) {
    blocks.push(`<div class="lesson-label">4. CORE CONCEPTS & DETAILED EXPLANATIONS</div>`);
    lesson.coreConcepts.forEach(concept => {
      blocks.push(`
        <div class="lesson-block" style="margin-bottom:1rem;padding:0.95rem 1.05rem;border-left:3px solid ${escapeHtml(topic.color?.dot || "#5b8b65")};">
          <h3 style="margin:0 0 0.5rem 0;font-size:1.05rem;">${escapeHtml(concept.title)}</h3>
          ${formatRichText(concept.explanation)}
          ${concept.keyTakeaway ? `<div style="margin-top:0.5rem;font-size:0.86rem;padding:0.45rem 0.65rem;border-radius:8px;background:rgba(91,139,101,0.08);"><strong>Key takeaway:</strong> ${escapeHtml(concept.keyTakeaway)}</div>` : ""}
        </div>
      `);
    });
  }

  if (lesson.terminology?.length) {
    blocks.push(`
      <div class="lesson-label">5. KEY TERMINOLOGY & DEFINITIONS</div>
      <div class="lesson-table">${lesson.terminology.map(t => `<div><strong>${escapeHtml(t.term)}</strong><span>${escapeHtml(t.definition)}</span></div>`).join("")}</div>
    `);
  }

  if (lesson.stepByStepProcesses?.length) {
    blocks.push(`<div class="lesson-label">6. STEP-BY-STEP PROCESSES & MECHANISMS</div>`);
    lesson.stepByStepProcesses.forEach(proc => {
      blocks.push(`
        <div class="lesson-block" style="margin-bottom:0.85rem;">
          <strong>${escapeHtml(proc.title)}</strong>
          <ol style="margin:0.5rem 0 0 1.25rem;line-height:1.6;">${proc.steps.map(s => `<li style="margin-bottom:0.35rem;">${escapeHtml(s)}</li>`).join("")}</ol>
        </div>
      `);
    });
  }

  if (lesson.workedExamples?.length) {
    blocks.push(`<div class="lesson-label">7. WORKED EXAMPLES & DEMONSTRATIONS</div>`);
    lesson.workedExamples.forEach(ex => {
      blocks.push(`
        <div class="lesson-block" style="margin-bottom:0.9rem;background:#eef2f8;">
          <strong>${escapeHtml(ex.title)}</strong>
          ${ex.problemOrScenario ? `<div style="margin-top:0.45rem;"><em>Problem / Scenario:</em> ${formatRichText(ex.problemOrScenario)}</div>` : ""}
          <div style="margin-top:0.45rem;"><em>Walkthrough:</em> ${formatRichText(ex.walkthrough)}</div>
          ${ex.resultOrTakeaway ? `<div style="margin-top:0.45rem;"><strong>Result:</strong> ${escapeHtml(ex.resultOrTakeaway)}</div>` : ""}
        </div>
      `);
    });
  }

  if (lesson.diagramsTablesCode?.length) {
    blocks.push(`<div class="lesson-label">8. FORMULAS, CODE, TABLES & REFERENCE ARTIFACTS</div>`);
    lesson.diagramsTablesCode.forEach(art => {
      blocks.push(`
        <div class="lesson-block" style="margin-bottom:0.9rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
            <strong>${escapeHtml(art.title)}</strong>
            <span class="source-pill">${escapeHtml(art.type.toUpperCase())}</span>
          </div>
          <pre style="white-space:pre-wrap;overflow-x:auto;padding:0.75rem;border-radius:8px;background:#1e232a;color:#f4f6f8;font-size:0.84rem;line-height:1.5;">${escapeHtml(art.content)}</pre>
          ${art.caption ? `<small style="display:block;margin-top:0.35rem;opacity:0.8;">${escapeHtml(art.caption)}</small>` : ""}
        </div>
      `);
    });
  }

  if (lesson.comparisons?.length) {
    blocks.push(`<div class="lesson-label">9. CONCEPT COMPARISONS</div>`);
    lesson.comparisons.forEach(comp => {
      const ths = comp.headers.map(h => `<th style="text-align:left;padding:0.5rem;border-bottom:2px solid #dde2dc;">${escapeHtml(h)}</th>`).join("");
      const trs = comp.rows.map(row => `<tr>${row.map(cell => `<td style="padding:0.5rem;border-bottom:1px solid #ecefe9;vertical-align:top;">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
      blocks.push(`
        <div class="lesson-block" style="overflow-x:auto;margin-bottom:0.9rem;">
          <strong style="display:block;margin-bottom:0.5rem;">${escapeHtml(comp.title)}</strong>
          <table style="width:100%;border-collapse:collapse;font-size:0.88rem;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
        </div>
      `);
    });
  }

  if (lesson.realWorldApplications?.length) {
    blocks.push(`<div class="lesson-label">10. REAL-WORLD APPLICATIONS</div><ul class="lesson-list">${lesson.realWorldApplications.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`);
  }

  const adv = lesson.advantagesAndLimitations || {};
  if (adv.advantages?.length || adv.disadvantages?.length || adv.limitations?.length) {
    blocks.push(`<div class="lesson-label">11. ADVANTAGES, DISADVANTAGES & LIMITATIONS</div><div class="lesson-block">`);
    if (adv.advantages?.length) blocks.push(`<strong>Advantages</strong><ul class="lesson-list">${adv.advantages.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`);
    if (adv.disadvantages?.length) blocks.push(`<strong>Disadvantages</strong><ul class="lesson-list">${adv.disadvantages.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`);
    if (adv.limitations?.length) blocks.push(`<strong>Limitations / Scope</strong><ul class="lesson-list">${adv.limitations.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`);
    blocks.push(`</div>`);
  }

  if (lesson.commonMisconceptions?.length) {
    blocks.push(`<div class="lesson-label">12. COMMON MISCONCEPTIONS & MISTAKES</div>`);
    lesson.commonMisconceptions.forEach(m => {
      blocks.push(`
        <div class="lesson-block" style="margin-bottom:0.65rem;background:#f8eff1;">
          <div><strong>Misconception:</strong> ${escapeHtml(m.misconception)}</div>
          <div style="margin-top:0.35rem;"><strong>Correction:</strong> ${escapeHtml(m.correction)}</div>
        </div>
      `);
    });
  }

  if (lesson.knowledgeChecks?.length) {
    blocks.push(`<div class="lesson-label">13. KNOWLEDGE CHECKS</div>`);
    lesson.knowledgeChecks.forEach((kc, idx) => {
      blocks.push(`
        <details class="lesson-block" style="margin-bottom:0.55rem;cursor:pointer;">
          <summary><strong>Check ${idx + 1}:</strong> ${escapeHtml(kc.question)}</summary>
          <div style="margin-top:0.55rem;padding-top:0.55rem;border-top:1px solid #e2e6df;">${formatRichText(kc.answer)}</div>
        </details>
      `);
    });
  }

  if (lesson.practiceExercises?.length) {
    blocks.push(`<div class="lesson-label">14. PRACTICE & PROBLEM-SOLVING EXERCISES</div>`);
    lesson.practiceExercises.forEach((ex, idx) => {
      blocks.push(`
        <details class="lesson-block" style="margin-bottom:0.65rem;cursor:pointer;">
          <summary><strong>Exercise ${idx + 1}:</strong> ${escapeHtml(ex.prompt)}</summary>
          ${ex.hint ? `<p style="margin:0.5rem 0 0;font-size:0.86rem;"><em>Hint:</em> ${escapeHtml(ex.hint)}</p>` : ""}
          ${ex.solution ? `<div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #e2e6df;"><strong>Solution:</strong> ${formatRichText(ex.solution)}</div>` : ""}
        </details>
      `);
    });
  }

  if (lesson.examStyleQuestions?.length) {
    blocks.push(`<div class="lesson-label">15. EXAMINATION-STYLE QUESTIONS</div>`);
    lesson.examStyleQuestions.forEach((q, idx) => {
      blocks.push(`
        <details class="lesson-block" style="margin-bottom:0.65rem;cursor:pointer;">
          <summary><strong>Q${idx + 1} [${q.marks} marks]:</strong> ${escapeHtml(q.question)}</summary>
          <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #e2e6df;"><strong>Marking Criteria:</strong> ${formatRichText(q.markingGuidance)}</div>
        </details>
      `);
    });
  }

  if (lesson.recap) {
    blocks.push(`<div class="lesson-label">16. FINAL RECAP</div><div class="lesson-block" style="background:#edf4ee;">${formatRichText(lesson.recap)}</div>`);
  }

  if (lesson.sourceLimitations?.length) {
    blocks.push(`<div class="lesson-label">SOURCE MATERIAL LIMITATIONS</div><ul class="lesson-list">${lesson.sourceLimitations.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`);
  }

  const refs = lesson.sourceReferences?.length ? lesson.sourceReferences : topic.sections.map(s => s.title);
  if (refs.length) {
    blocks.push(`<div class="source-caption" style="margin-top:0.75rem;">Traced to source sections: ${escapeHtml(refs.join(" · "))}</div>`);
  }

  return blocks.join("");
}

async function openTopic(topicId, forceRegenerate = false) {
  const entry = findTopicEntry(topicId);
  if (!entry) return;
  const { module: mod, topic } = entry;

  elements.dialogContent.onclick = null;
  elements.dialogContent.onsubmit = null;
  activeTopicId = topic.id;
  renderTopics();
  elements.breadcrumb.textContent = `${mod.name} / ${topic.title}`;

  if (!topic.lesson || forceRegenerate) {
    elements.dialogContent.innerHTML = dialogFrame("COMPREHENSIVE LESSON GENERATOR", `
      <h2>Building your lesson on ${escapeHtml(topic.title)}…</h2>
      <p class="dialog-subtitle loading-dots">Adapting explanations, examples, terminology, and checks for <strong>${escapeHtml(mod.discipline)}</strong>…</p>
    `);
    openDialog();

    if (aiAvailable) {
      try {
        const result = await requestApi("generate-lesson", {
          topicTitle: topic.title,
          subtopics: topic.subtopics,
          sourceContext: topicContext(topic),
          module: {
            name: mod.name,
            discipline: mod.discipline,
            knowledgeTypes: mod.knowledgeTypes
          },
          ...getProfile()
        });
        topic.lesson = result.lesson;
        topic.sourceMode = "AI · Comprehensive Lesson";
        persistModules();
        renderTopics();
      } catch (error) {
        showToast(`Using local lesson fallback: ${error.message}`, 6000);
        topic.lesson = createLocalLessonFallback(topic, mod);
        persistModules();
      }
    } else {
      topic.lesson = createLocalLessonFallback(topic, mod);
      persistModules();
    }
  }

  const enrichedTopic = { ...topic, moduleMeta: mod };
  elements.dialogContent.innerHTML = dialogFrame("STRUCTURED ACADEMIC LESSON", `
    <h2>${escapeHtml(topic.title)}</h2>
    <p class="dialog-subtitle">Comprehensive lesson adapted to your module material. <span class="source-pill">${escapeHtml(topic.sourceMode || "Source-grounded")}</span></p>
    ${renderLessonHtml(enrichedTopic, topic.lesson)}
    <div class="dialog-actions" style="margin-top:1.25rem;flex-wrap:wrap;gap:0.5rem;">
      <button class="button button-secondary" type="button" data-action="regenerate-lesson" data-topic-id="${escapeHtml(topic.id)}">Regenerate lesson</button>
      <button class="button button-secondary" type="button" data-action="explain" data-topic-id="${escapeHtml(topic.id)}">Deep explanation</button>
      <button class="button button-secondary" type="button" data-action="chat" data-topic-id="${escapeHtml(topic.id)}">AI Teaching Assistant</button>
      <button class="button button-secondary" type="button" data-action="flashcards" data-topic-id="${escapeHtml(topic.id)}">Smart Flashcards</button>
      <button class="button button-secondary" type="button" data-action="download-study-sheet" data-topic-id="${escapeHtml(topic.id)}">Export (.md)</button>
      <button class="button button-primary" type="button" data-action="quiz" data-topic-id="${escapeHtml(topic.id)}">Check understanding <span aria-hidden="true">→</span></button>
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
    return "I can’t find enough information about that in the notes you shared. Add a relevant source section or enable AI mode for deeper explanation.";
  }
  return `Here’s what your notes say:\n\n${matches.map(item => `${item.section.title}: ${item.section.keyPoints?.slice(0, 2).join(" ") || item.section.text.slice(0, 600)}`).join("\n\n")}`;
}

async function explainTopic(topicId, mode = "comprehensive") {
  const topic = getTopic(topicId);
  if (!topic) return;
  elements.dialogContent.onclick = null;
  elements.dialogContent.onsubmit = null;
  elements.dialogContent.innerHTML = dialogFrame("DEEP PEDAGOGICAL EXPLANATION", `
    <h2>Understanding ${escapeHtml(topic.title)}</h2>
    <p class="dialog-subtitle">Anchored in your notes and expanded with intuition, structure, and real-world examples.</p>
    <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.85rem;">
      <button class="button button-secondary" type="button" data-action="explain-mode" data-mode="simpler" data-topic-id="${escapeHtml(topic.id)}">Explain simpler</button>
      <button class="button button-secondary" type="button" data-action="explain-mode" data-mode="comprehensive" data-topic-id="${escapeHtml(topic.id)}">Full breakdown</button>
      <button class="button button-secondary" type="button" data-action="explain-mode" data-mode="advanced" data-topic-id="${escapeHtml(topic.id)}">Advanced / exam depth</button>
    </div>
    <div class="tutor-answer" id="tutor-answer" aria-live="polite"><span class="loading-dots">Building a ${escapeHtml(mode)} explanation…</span></div>
    <div class="dialog-actions" style="margin-top:1rem;">
      <button class="button button-secondary" type="button" data-action="study-lesson" data-topic-id="${escapeHtml(topic.id)}">← Back to lesson</button>
      <button class="button button-primary" type="button" data-action="chat" data-topic-id="${escapeHtml(topic.id)}">Ask follow-up questions →</button>
    </div>`);
  openDialog();

  const sections = topic.sections.map(section => ({ title: section.title }));
  try {
    let answer;
    if (aiAvailable) {
      try {
        const result = await requestApi("explain", {
          topic: topic.title,
          mode,
          context: topicContext(topic),
          sections,
          ...getProfile()
        });
        answer = result.answer;
      } catch (error) {
        answer = `${localSourceAnswer(topic, topic.title)}\n\n(Local fallback: ${error.message})`;
      }
    } else {
      answer = `${localSourceAnswer(topic, topic.title)}\n\n(Local demo mode — AI is not configured.)`;
    }
    const output = elements.dialogContent.querySelector("#tutor-answer");
    if (output) output.innerHTML = formatRichText(answer);
  } catch (_error) {
    showToast("Could not prepare an explanation.");
  }
}

function openChat(topicId) {
  const entry = findTopicEntry(topicId);
  if (!entry) return;
  const { module: mod, topic } = entry;
  elements.dialogContent.onclick = null;
  const history = [];

  const quickPrompts = [
    { label: "Explain simpler", text: "Explain the core ideas of this topic in simpler, intuitive terms with an everyday analogy." },
    { label: "Most important takeaways", text: "What are the most important concepts and high-yield takeaways in this topic, and why do they matter?" },
    { label: "Step-by-step walkthrough", text: "Walk me through how the concepts in this topic work step by step." },
    { label: "Real-world example", text: "Give me a concrete, realistic real-world example applying these concepts." },
    { label: "Go deeper / advanced", text: "Give me a deeper, university-exam-level explanation including edge cases and trade-offs." },
    { label: "Connect to other topics", text: "How does this topic connect to the other topics in this module?" }
  ];

  const render = (busy = false) => {
    elements.dialogContent.innerHTML = dialogFrame("AI TEACHING ASSISTANT", `
      <h2>Ask anything about ${escapeHtml(topic.title)}</h2>
      <p class="dialog-subtitle">Grounded in your notes with expanded explanations, examples, and cross-topic links.</p>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem;">
        ${quickPrompts.map((qp, idx) => `<button type="button" class="button button-secondary" style="font-size:0.78rem;padding:0.35rem 0.65rem;" data-quick-prompt="${idx}" ${busy ? "disabled" : ""}>${escapeHtml(qp.label)}</button>`).join("")}
      </div>
      <div class="chat-thread" id="chat-thread" aria-live="polite">${history.length ? history.map(item => `
        <div class="chat-message ${item.role === "user" ? "from-user" : "from-tutor"}">
          <span>${item.role === "user" ? "YOU" : "AI TEACHING ASSISTANT"}</span>
          <div>${formatRichText(item.text)}</div>
        </div>`).join("") : '<p class="chat-empty">Click a quick prompt above or type your own question below.</p>'}
        ${busy ? '<div class="chat-message from-tutor"><span>AI TEACHING ASSISTANT</span><p class="loading-dots">Synthesizing explanation…</p></div>' : ""}</div>
      <form class="chat-form" id="chat-form">
        <label class="sr-only" for="chat-question">Ask a question</label>
        <input id="chat-question" name="question" maxlength="2000" placeholder="Ask for simpler explanations, examples, comparisons, or clarification…" required ${busy ? "disabled" : ""}>
        <button class="button button-primary" type="submit" ${busy ? "disabled" : ""}>Send</button>
      </form>
      <div class="dialog-actions" style="margin-top:0.75rem;">
        <button class="button button-secondary" type="button" data-action="study-lesson" data-topic-id="${escapeHtml(topic.id)}">← Back to lesson</button>
      </div>`);
    const thread = elements.dialogContent.querySelector("#chat-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  };

  const submitQuestion = async (question) => {
    if (!question.trim()) return;
    history.push({ role: "user", text: question.trim() });
    render(true);
    try {
      let answer;
      if (aiAvailable) {
        try {
          const crossModuleSummary = (mod.topics || [])
            .map(t => `- ${t.title}: ${(t.subtopics || []).join(", ")}`)
            .join("\n");
          const result = await requestApi("chat", {
            question: question.trim(),
            history: history.slice(0, -1),
            context: topicContext({ ...topic, moduleMeta: mod }),
            crossModuleSummary,
            ...getProfile()
          });
          answer = result.answer;
        } catch (error) {
          answer = `${localSourceAnswer({ ...topic, moduleMeta: mod }, question)}\n\n(Local fallback: ${error.message})`;
        }
      } else {
        answer = localSourceAnswer({ ...topic, moduleMeta: mod }, question);
      }
      history.push({ role: "assistant", text: answer });
    } catch (_error) {
      history.push({ role: "assistant", text: "I couldn’t prepare a response. Please try again." });
    }
    render();
    const nextInput = elements.dialogContent.querySelector("#chat-question");
    if (nextInput) nextInput.focus();
  };

  elements.dialogContent.onclick = event => {
    const qpBtn = event.target.closest("[data-quick-prompt]");
    if (qpBtn) {
      const idx = Number(qpBtn.dataset.quickPrompt);
      if (quickPrompts[idx]) submitQuestion(quickPrompts[idx].text);
    }
  };

  elements.dialogContent.onsubmit = event => {
    if (!event.target.matches("#chat-form")) return;
    event.preventDefault();
    submitQuestion(event.target.elements.question.value);
  };

  render();
  openDialog();
}

function makeLocalFlashcards(topic) {
  const cards = [];
  if (topic.lesson?.terminology?.length) {
    topic.lesson.terminology.forEach(t => cards.push({
      type: "Definition",
      difficulty: "Foundational",
      front: `Define: ${t.term}`,
      back: t.definition,
      explanation: "",
      sourceReference: topic.title
    }));
  }
  if (topic.lesson?.knowledgeChecks?.length) {
    topic.lesson.knowledgeChecks.forEach(kc => cards.push({
      type: "Conceptual",
      difficulty: "Intermediate",
      front: kc.question,
      back: kc.answer,
      explanation: "",
      sourceReference: topic.title
    }));
  }
  if (!cards.length) {
    topic.sections.forEach(section => {
      cards.push({
        type: "Conceptual",
        difficulty: "Foundational",
        front: `What are the core ideas in “${section.title}”?`,
        back: section.keyPoints?.join("\n") || section.text,
        explanation: "",
        sourceReference: section.title
      });
    });
  }
  return cards;
}

async function openFlashcards(topicId, forceRegenerate = false) {
  const entry = findTopicEntry(topicId);
  if (!entry) return;
  const { module: mod, topic } = entry;
  elements.dialogContent.onsubmit = null;

  if (!Array.isArray(topic.flashcards) || !topic.flashcards.length || forceRegenerate) {
    if (aiAvailable) {
      elements.dialogContent.innerHTML = dialogFrame("INTELLIGENT FLASHCARD GENERATOR", `
        <h2>Designing active-recall cards for ${escapeHtml(topic.title)}…</h2>
        <p class="dialog-subtitle loading-dots">Creating definition, conceptual, comparison, and application cards…</p>
      `);
      openDialog();
      try {
        const lessonSummary = topic.lesson
          ? `Objectives: ${(topic.lesson.learningObjectives || []).join("; ")}\nConcepts: ${(topic.lesson.coreConcepts || []).map(c => `${c.title}: ${c.explanation}`).join("\n")}`
          : "";
        const result = await requestApi("flashcards", {
          topic: topic.title,
          context: topicContext(topic),
          lessonSummary,
          ...getProfile()
        });
        topic.flashcards = result.cards || [];
        persistModules();
      } catch (error) {
        showToast(`Using local flashcards fallback: ${error.message}`);
        topic.flashcards = makeLocalFlashcards(topic);
      }
    } else {
      topic.flashcards = makeLocalFlashcards(topic);
    }
  }

  const cards = topic.flashcards;
  let current = 0;
  let flipped = false;

  const render = () => {
    const card = cards[current];
    elements.dialogContent.innerHTML = dialogFrame(`SMART FLASHCARDS · ${escapeHtml(topic.title.toUpperCase())}`, `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <div>
          <span class="source-pill">${escapeHtml(card.type || "Conceptual")}</span>
          <span class="source-pill" style="margin-left:4px;">${escapeHtml(card.difficulty || "Intermediate")}</span>
        </div>
        <button class="button button-secondary" type="button" style="font-size:0.78rem;padding:0.3rem 0.6rem;" data-action="flash-regenerate">Regenerate deck</button>
      </div>
      <button class="flashcard" type="button" style="min-height:210px;">
        <span class="flash-label">${flipped ? "ANSWER & INTUITION" : "PROMPT"} · CARD ${current + 1} OF ${cards.length}</span>
        <p style="font-size:1.05rem;line-height:1.55;">${escapeHtml(flipped ? card.back : card.front).replace(/\n/g, "<br>")}</p>
        ${flipped && card.explanation ? `<small style="display:block;margin-top:0.75rem;padding:0.55rem 0.75rem;border-radius:8px;background:rgba(91,139,101,0.1);line-height:1.45;"><strong>Why this matters:</strong> ${escapeHtml(card.explanation)}</small>` : ""}
        ${card.sourceReference ? `<small style="display:block;margin-top:0.5rem;opacity:0.65;">Source: ${escapeHtml(card.sourceReference)}</small>` : ""}
        <span class="flash-hint">Click card to ${flipped ? "see the question" : "reveal the answer"}</span>
      </button>
      <div class="dialog-actions" style="margin-top:1rem;">
        <button class="button button-secondary" type="button" data-action="study-lesson" data-topic-id="${escapeHtml(topic.id)}">← Lesson</button>
        <button class="button button-secondary" type="button" data-action="flash-prev">← Previous</button>
        <button class="button button-primary" type="button" data-action="flash-next">${current === cards.length - 1 ? "Start again" : "Next card"} →</button>
      </div>`);
  };

  elements.dialogContent.onclick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.classList.contains("flashcard")) { flipped = !flipped; render(); }
    else if (button.dataset.action === "flash-next") { current = (current + 1) % cards.length; flipped = false; render(); }
    else if (button.dataset.action === "flash-prev") { current = (current - 1 + cards.length) % cards.length; flipped = false; render(); }
    else if (button.dataset.action === "flash-regenerate") { openFlashcards(topic.id, true); }
  };

  render();
  openDialog();
}

async function openQuiz(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  elements.dialogContent.onsubmit = null;
  let questions = [];
  if (aiAvailable) {
    elements.dialogContent.innerHTML = dialogFrame("SOURCE-GROUNDED QUIZ", `<h2>Preparing assessment…</h2><p class="dialog-subtitle loading-dots">Building questions from ${escapeHtml(topic.title)}.</p>`);
    openDialog();
    try {
      const result = await requestApi("quiz", { topic: topic.title, context: topicContext(topic), ...getProfile() });
      questions = result.questions || [];
    } catch (error) {
      showToast(`AI quiz unavailable (${error.message}).`);
    }
  }
  if (!questions.length) {
    showToast("Connect AI mode to generate dynamic assessments for this topic.");
    return;
  }

  let current = 0;
  let score = 0;
  let answered = false;

  const render = () => {
    if (current >= questions.length) {
      elements.dialogContent.innerHTML = dialogFrame("QUICK CHECK", `
        <h2>Assessment complete.</h2>
        <p class="dialog-subtitle">You scored ${score} out of ${questions.length} on ${escapeHtml(topic.title)}.</p>
        <div class="dialog-actions">
          <button class="button button-secondary" type="button" data-action="study-lesson" data-topic-id="${escapeHtml(topic.id)}">← Back to lesson</button>
          <button class="button button-secondary" type="button" data-action="quiz-restart">Try again</button>
          <button class="button button-primary" type="button" data-action="quiz-close">Done</button>
        </div>`);
      return;
    }
    const q = questions[current];
    elements.dialogContent.innerHTML = dialogFrame(`QUICK CHECK · ${escapeHtml(topic.title.toUpperCase())}`, `
      <div class="quiz-progress">QUESTION ${current + 1} OF ${questions.length}</div>
      <h2 class="quiz-question">${escapeHtml(q.question)}</h2>
      <div class="quiz-options">${q.options.map((opt, idx) => `
        <button class="quiz-option" type="button" data-action="quiz-answer" data-correct="${idx === q.answerIndex}">${escapeHtml(opt)}</button>`).join("")}</div>
      <div class="quiz-feedback" aria-live="polite"></div>
      <div class="dialog-actions"><span class="quiz-progress">Score: ${score}</span><button class="button button-primary" type="button" data-action="quiz-next" disabled>${current === questions.length - 1 ? "See results" : "Next"} →</button></div>`);
  };

  elements.dialogContent.onclick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "quiz-answer" && !answered) {
      answered = true;
      const isCorrect = button.dataset.correct === "true";
      if (isCorrect) score += 1;
      elements.dialogContent.querySelectorAll(".quiz-option").forEach(opt => {
        opt.disabled = true;
        if (opt.dataset.correct === "true") opt.classList.add("correct");
      });
      if (!isCorrect) button.classList.add("incorrect");
      const q = questions[current];
      elements.dialogContent.querySelector(".quiz-feedback").textContent = `${isCorrect ? "Correct. " : "Incorrect. "}${q.explanation || ""}`;
      elements.dialogContent.querySelector('[data-action="quiz-next"]').disabled = false;
    } else if (button.dataset.action === "quiz-next") { current += 1; answered = false; render(); }
    else if (button.dataset.action === "quiz-restart") { current = 0; score = 0; answered = false; render(); }
    else if (button.dataset.action === "quiz-close") closeDialog();
  };

  render();
  openDialog();
}

function downloadStudySheet(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return;
  const l = topic.lesson || {};
  const lines = [
    `# ${topic.title}`,
    topic.moduleMeta?.name ? `**Module:** ${topic.moduleMeta.name} (${topic.moduleMeta.discipline})` : "",
    "",
    ...(l.learningObjectives?.length ? ["## Learning Objectives", ...l.learningObjectives.map(o => `- ${o}`), ""] : []),
    ...(l.introduction ? ["## Introduction", l.introduction, ""] : []),
    ...(l.coreConcepts?.length ? ["## Core Concepts", ...l.coreConcepts.flatMap(c => [`### ${c.title}`, c.explanation, c.keyTakeaway ? `> **Key takeaway:** ${c.keyTakeaway}` : "", ""])] : []),
    ...(l.terminology?.length ? ["## Key Terminology", ...l.terminology.map(t => `- **${t.term}:** ${t.definition}`), ""] : []),
    ...(l.workedExamples?.length ? ["## Worked Examples", ...l.workedExamples.flatMap(ex => [`### ${ex.title}`, ex.problemOrScenario, ex.walkthrough, ex.resultOrTakeaway ? `**Result:** ${ex.resultOrTakeaway}` : "", ""])] : []),
    ...(l.recap ? ["## Final Recap", l.recap, ""] : [])
  ].filter(line => line !== null);

  downloadFile(`${safeFilename(topic.title)}-lesson.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  showToast("Comprehensive lesson downloaded.");
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
  } catch (_error) {
    showToast("Could not save your student profile.");
    return false;
  }
}

function openStudentProfile() {
  const presetButtons = Object.entries(STUDY_PRESETS).map(([id, preset]) => `
    <button class="study-preset${studentProfile.preset === id ? " selected" : ""}" type="button" data-study-preset="${id}">${preset.label}</button>`).join("");
  elements.dialogContent.innerHTML = dialogFrame("STUDENT PROFILE", `
    <h2>Make this study space yours.</h2>
    <p class="dialog-subtitle">Your modules, lessons, and progress stay stored in this browser.</p>
    <form id="student-profile-form">
      <div class="student-profile-grid">
        <label>First name<input name="firstName" type="text" maxlength="60" placeholder="e.g. Tiago"></label>
        <label>Degree / programme<input name="degree" type="text" maxlength="140" placeholder="e.g. BSc IT Software Engineering"></label>
        <label class="student-profile-wide">Current study goal<textarea name="studyGoal" rows="3" maxlength="700" placeholder="e.g. Master interaction design and HCI principles for finals"></textarea></label>
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
  saveStudentProfile(studentProfileFromForm(form));
  showToast(`${STUDY_PRESETS[presetId].label} preset applied.`);
}

function exportWorkspaceBackup() {
  const backup = {
    format: "studyflow-workspace",
    version: 2,
    exportedAt: new Date().toISOString(),
    modules,
    courseProfile: getCourseProfile(),
    studentProfile
  };
  downloadFile(`studyflow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
  showToast("Workspace backup downloaded.");
}

async function importWorkspaceBackup(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.format !== "studyflow-workspace" || !Array.isArray(parsed.modules)) {
      throw new Error("Unsupported or invalid workspace backup file.");
    }
    if (!window.confirm("Replace your current browser workspace with this backup?")) return;
    modules = parsed.modules;
    persistModules();
    renderTopics();
    closeDialog();
    showToast("Workspace backup imported.");
  } catch (error) {
    showToast(error.message || "Could not import backup.");
  } finally {
    elements.workspaceImportFile.value = "";
  }
}

function openStudyMode() {
  const list = allTopics();
  if (!list.length) {
    showToast("Organize some module notes first to launch study mode.");
    elements.textarea.focus();
    return;
  }
  const latest = list[list.length - 1];
  openTopic(latest.id);
}

function fillSample() {
  elements.textarea.value = `Computer Networks: Dynamic Routing with OSPF

Open Shortest Path First (OSPF) is a link-state interior gateway routing protocol standardized in RFC 2328. Unlike distance-vector protocols such as RIPv2 that exchange entire routing tables with neighbors periodically, OSPF routers exchange Link-State Advertisements (LSAs) describing the state of their directly connected interfaces.

Link-State Database and Dijkstra's SPF Algorithm
Every router within the same OSPF area maintains an identical topological map called the Link-State Database (LSDB). Using the LSDB as input, each router independently runs Dijkstra's Shortest Path First (SPF) algorithm with itself as the root to compute the lowest-cost loop-free paths to all destination networks.

Cost Metric Calculation
OSPF calculates interface cost using the formula: Cost = Reference Bandwidth / Interface Bandwidth. By default, Cisco IOS sets the reference bandwidth to 100 Mbps (10^8 bps), meaning FastEthernet (100 Mbps) has a cost of 1, while GigabitEthernet (1000 Mbps) also defaults to 1 unless the reference bandwidth is adjusted via auto-cost reference-bandwidth.`;
  updateWordCount();
  organizeNotes();
}

function updateWordCount() {
  elements.wordCount.textContent = formatWordCount(countWords(elements.textarea.value));
}

function showUploadMetadata(filename, metadata) {
  elements.uploadMeta.hidden = false;
  elements.uploadMeta.innerHTML = `<span class="upload-file-check" aria-hidden="true">✓</span><strong>${escapeHtml(filename)}</strong><span>${metadata.words.toLocaleString()} words · ${metadata.type}${metadata.pages ? ` · ${metadata.pages} pages` : ""}</span><button type="button" class="upload-remove" aria-label="Dismiss uploaded file">×</button>`;
}

async function handleUpload(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    showToast("File exceeds the 12 MB upload limit.");
    return;
  }
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "txt", "docx", "md"].includes(extension)) {
    showToast("Choose a PDF, DOCX, TXT, or Markdown file.");
    return;
  }
  elements.uploadZone.classList.add("is-loading");
  try {
    let text = "";
    let metadata = { type: extension.toUpperCase(), words: 0 };
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Server could not parse file.");
      text = result.text;
      metadata = result.metadata;
      uploadName = result.filename;
    } catch (error) {
      if (extension !== "txt" && extension !== "md") throw error;
      text = await file.text();
      metadata.words = countWords(text);
      uploadName = file.name;
    }
    if (text.length > 60000) text = text.slice(0, 60000);
    elements.textarea.value = text;
    updateWordCount();
    showUploadMetadata(uploadName, metadata);
    showToast(`${uploadName} loaded. Click "Build my study guide" to analyse.`);
  } catch (error) {
    showToast(error.message || "Could not read that file.");
  } finally {
    elements.uploadZone.classList.remove("is-loading");
    elements.fileInput.value = "";
  }
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
    if (button.dataset.view === "study") openStudyMode();
    else { elements.breadcrumb.textContent = "My library"; closeDialog(); }
  });
});
elements.topicNav.addEventListener("click", event => {
  const del = event.target.closest('[data-action="delete-topic"]');
  if (del) { deleteTopic(del.dataset.topicId); return; }
  const btn = event.target.closest(".topic-link[data-topic-id]");
  if (btn) openTopic(btn.dataset.topicId);
});
elements.pathContent.addEventListener("click", event => {
  const del = event.target.closest('[data-action="delete-topic"]');
  if (del) { deleteTopic(del.dataset.topicId); return; }
  const btn = event.target.closest(".path-topic-open[data-topic-id]");
  if (btn) openTopic(btn.dataset.topicId);
});
elements.dialogContent.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  const topicId = button.dataset.topicId;
  if (button.classList.contains("dialog-close")) closeDialog();
  else if (action === "study-lesson") openTopic(topicId);
  else if (action === "regenerate-lesson") openTopic(topicId, true);
  else if (action === "delete-topic") deleteTopic(topicId);
  else if (action === "download-study-sheet") downloadStudySheet(topicId);
  else if (action === "export-workspace") exportWorkspaceBackup();
  else if (action === "import-workspace") elements.workspaceImportFile.click();
  else if (button.dataset.studyPreset) applyStudyPreset(button.dataset.studyPreset);
  else if (action === "flashcards") openFlashcards(topicId);
  else if (action === "quiz") openQuiz(topicId);
  else if (action === "explain") explainTopic(topicId);
  else if (action === "explain-mode") explainTopic(topicId, button.dataset.mode);
  else if (action === "chat") openChat(topicId);
});
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) closeDialog(); });

document.querySelector("#choose-file").addEventListener("click", e => { e.stopPropagation(); elements.fileInput.click(); });
elements.uploadZone.addEventListener("click", e => {
  if (e.target.closest(".upload-remove")) { elements.uploadMeta.hidden = true; uploadName = ""; return; }
  if (!e.target.closest("button")) elements.fileInput.click();
});
elements.fileInput.addEventListener("change", () => handleUpload(elements.fileInput.files[0]));
["dragenter", "dragover"].forEach(t => elements.uploadZone.addEventListener(t, e => { e.preventDefault(); elements.uploadZone.classList.add("is-dragging"); }));
["dragleave", "drop"].forEach(t => elements.uploadZone.addEventListener(t, e => { e.preventDefault(); elements.uploadZone.classList.remove("is-dragging"); }));
elements.uploadZone.addEventListener("drop", e => handleUpload(e.dataTransfer.files[0]));

loadProfile();
document.querySelectorAll(".profile-grid input, .profile-grid select, .profile-grid textarea").forEach(field => {
  field.addEventListener("input", () => localStorage.setItem(PROFILE_KEY, JSON.stringify(getProfile())));
  field.addEventListener("change", () => localStorage.setItem(PROFILE_KEY, JSON.stringify(getProfile())));
});
elements.studentProfileButton.addEventListener("click", openStudentProfile);
elements.workspaceImportFile.addEventListener("change", () => importWorkspaceBackup(elements.workspaceImportFile.files[0]));

checkApiStatus();
renderTopics();
renderStudentProfile();
updateWordCount();