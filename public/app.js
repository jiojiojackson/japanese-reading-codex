const sourceText = document.querySelector("#sourceText");
const preview = document.querySelector("#preview");
const docsList = document.querySelector("#docsList");
const saveButton = document.querySelector("#saveButton");
const newButton = document.querySelector("#newButton");
const refreshButton = document.querySelector("#refreshButton");
const saveState = document.querySelector("#saveState");
const docTemplate = document.querySelector("#docItemTemplate");

let currentDocId = null;
let currentTitle = "";
let annotations = new Map();
let isDirty = false;

const kanjiPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

function setDirty(value) {
  isDirty = value;
  saveState.textContent = currentDocId
    ? value ? "有未保存修改" : `正在编辑：${currentTitle}`
    : value ? "新文档未保存" : "未保存";
}

function annotationKey(index, char) {
  return `${index}:${char}`;
}

function renderPreview() {
  preview.replaceChildren();
  const text = sourceText.value;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!kanjiPattern.test(char)) {
      preview.append(document.createTextNode(char));
      continue;
    }

    const ruby = document.createElement("ruby");
    const rb = document.createElement("rb");
    const rt = document.createElement("rt");
    const input = document.createElement("input");
    const key = annotationKey(index, char);

    rb.textContent = char;
    input.className = "ruby-input";
    input.inputMode = "text";
    input.autocomplete = "off";
    input.value = annotations.get(key) || "";
    input.setAttribute("aria-label", `${char} 的注音`);
    input.addEventListener("input", () => {
      const value = input.value.trim();
      if (value) {
        annotations.set(key, value);
      } else {
        annotations.delete(key);
      }
      setDirty(true);
    });

    rt.append(input);
    ruby.append(rb, rt);
    preview.append(ruby);
  }
}

function collectDocument() {
  const text = sourceText.value;
  const entries = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const value = annotations.get(annotationKey(index, char));
    if (value) {
      entries.push({ index, char, ruby: value });
    }
  }
  return {
    id: currentDocId,
    title: currentTitle,
    source: text,
    annotations: entries
  };
}

function loadDocument(doc) {
  currentDocId = doc.id;
  currentTitle = doc.title || "未命名";
  annotations = new Map();
  for (const item of doc.annotations || []) {
    annotations.set(annotationKey(item.index, item.char), item.ruby);
  }
  sourceText.value = doc.source || "";
  renderPreview();
  setDirty(false);
}

function resetEditor() {
  currentDocId = null;
  currentTitle = "";
  annotations = new Map();
  sourceText.value = "";
  renderPreview();
  setDirty(false);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `请求失败：${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

async function saveDocument() {
  const title = prompt("请输入文件名", currentTitle || "日语注音文档");
  if (!title) return;

  currentTitle = title.trim();
  const payload = collectDocument();
  payload.title = currentTitle;

  const saved = currentDocId
    ? await requestJson(`/api/docs/${currentDocId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      })
    : await requestJson("/api/docs", {
        method: "POST",
        body: JSON.stringify(payload)
      });

  currentDocId = saved.id;
  currentTitle = saved.title;
  setDirty(false);
  await loadDocs();
  alert("保存成功");
}

async function editDocument(id) {
  if (isDirty && !confirm("当前修改尚未保存，确定切换文档吗？")) return;
  const doc = await requestJson(`/api/docs/${id}`);
  loadDocument(doc);
}

async function deleteDocument(id, title) {
  if (!confirm(`确定删除「${title}」吗？`)) return;
  await requestJson(`/api/docs/${id}`, { method: "DELETE" });
  if (currentDocId === id) resetEditor();
  await loadDocs();
}

async function shareDocument(id) {
  const url = `${location.origin}/view/${id}`;
  await navigator.clipboard?.writeText(url).catch(() => {});
  prompt("公共分享 URL", url);
}

async function loadDocs() {
  docsList.replaceChildren();
  const docs = await requestJson("/api/docs");
  if (!docs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有保存的文档。粘贴文本、填写注音后点击保存。";
    docsList.append(empty);
    return;
  }

  for (const doc of docs) {
    const item = docTemplate.content.firstElementChild.cloneNode(true);
    const titleButton = item.querySelector(".doc-title");
    const time = item.querySelector("time");
    const shareButton = item.querySelector('[data-action="share"]');
    const deleteButton = item.querySelector('[data-action="delete"]');

    titleButton.textContent = doc.title;
    titleButton.addEventListener("click", () => editDocument(doc.id));
    time.dateTime = doc.updatedAt;
    time.textContent = new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(doc.updatedAt));
    shareButton.addEventListener("click", () => shareDocument(doc.id));
    deleteButton.addEventListener("click", () => deleteDocument(doc.id, doc.title));
    docsList.append(item);
  }
}

sourceText.addEventListener("input", () => {
  const validKeys = new Set();
  const text = sourceText.value;
  for (let index = 0; index < text.length; index += 1) {
    validKeys.add(annotationKey(index, text[index]));
  }
  for (const key of annotations.keys()) {
    if (!validKeys.has(key)) annotations.delete(key);
  }
  renderPreview();
  setDirty(true);
});

saveButton.addEventListener("click", () => saveDocument().catch((error) => alert(error.message)));
newButton.addEventListener("click", () => {
  if (!isDirty || confirm("当前修改尚未保存，确定新建吗？")) resetEditor();
});
refreshButton.addEventListener("click", () => loadDocs().catch((error) => alert(error.message)));

renderPreview();
loadDocs().catch((error) => {
  docsList.innerHTML = `<p class="empty">${error.message}</p>`;
});
