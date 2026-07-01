import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  FileJson,
  FilePlus,
  FileText,
  FileUp,
  FolderOpen,
  LayoutList,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Printer,
  Save,
  Settings,
  Sparkles,
  Trash2
} from "lucide-react";
import { createProfileLink, listValue, normalizeDocument, profileLinks } from "./lib/document";
import { createBlankDocument, createSampleDocument } from "./lib/starter-documents";
import { createField, createItem, createSection, fieldKinds, sectionTemplates } from "./lib/templates";
import { generateLatex, visibleSections } from "./lib/latex";
import type { CVDocument, FieldDef, FieldKind, ProfileLink, SectionDef, SectionItem } from "./lib/types";

type Tab = "content" | "sections" | "preview";
type ContentView = "profile" | "section";
type FileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{
    write: (data: BlobPart) => Promise<void>;
    close: () => Promise<void>;
  }>;
};
type BrowserFileWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileHandle>;
};
type StartMode = "blank" | "template";

function reorder<T>(items: T[], from: number, to: number) {
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function valueToText(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : String(value ?? "");
}

function itemHasContent(item: SectionItem) {
  return Object.values(item.values).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim())));
}

function itemText(item: SectionItem, id: string) {
  return String(item.values[id] ?? "").trim();
}

function firstItemText(item: SectionItem, ids: string[]) {
  for (const id of ids) {
    const value = itemText(item, id);
    if (value) return value;
  }
  return "";
}

function itemList(item: SectionItem, id: string, stripMarkers = false) {
  return listValue(item.values[id], stripMarkers);
}

function sortYearDesc(items: SectionItem[]) {
  const year = (item: SectionItem) => Number((itemText(item, "year") || itemText(item, "date")).match(/\b(19|20)\d{2}\b/)?.[0] ?? 0);
  return [...items].sort((a, b) => year(b) - year(a));
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function defaultFileName(doc: CVDocument, extension: "json" | "tex") {
  const base = (doc.profile.name || "academic-cv")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "academic-cv";
  return `${base}.${extension}`;
}

async function writeHandle(handle: FileHandle, content: string) {
  if (!handle.createWritable) return false;
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

function jsonText(doc: CVDocument) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function sectionText(section: SectionDef) {
  return `${section.id} ${section.title}`.toLowerCase();
}

function isCitationSection(section: SectionDef) {
  const value = sectionText(section);
  return section.kind === "publication" ||
    section.kind === "presentation" ||
    /\b(publication|poster|podium|abstract)s?\b/.test(value);
}

function presentationType(section: SectionDef, item: SectionItem) {
  const explicitType = itemText(item, "type").toLowerCase();
  const value = `${sectionText(section)} ${explicitType}`;
  if (value.includes("poster")) return "Poster";
  if (value.includes("podium")) return "Podium";
  if (value.includes("abstract")) return "Abstract";
  if (value.includes("oral")) return "Oral presentation";
  return "Presentation";
}

export default function App() {
  const [doc, setDoc] = useState<CVDocument>(() => createSampleDocument());
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileHandle, setFileHandle] = useState<FileHandle | undefined>();
  const [selectedSectionId, setSelectedSectionId] = useState("education");
  const [contentView, setContentView] = useState<ContentView>("section");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>("content");
  const [status, setStatus] = useState("Choose how to start, then save your JSON locally when you are done.");
  const [startupOpen, setStartupOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const latex = useMemo(() => generateLatex(doc), [doc]);
  const orderedSections = useMemo(() => {
    const byId = new Map(doc.sections.map((section) => [section.id, section]));
    return [
      ...doc.settings.sectionOrder.map((id) => byId.get(id)).filter(Boolean),
      ...doc.sections.filter((section) => !doc.settings.sectionOrder.includes(section.id))
    ] as SectionDef[];
  }, [doc]);
  const selectedSection = orderedSections.find((section) => section.id === selectedSectionId) ?? orderedSections[0];
  const outputSections = visibleSections(doc);

  function updateDoc(updater: (current: CVDocument) => CVDocument) {
    setDoc((current) => updater(structuredClone(current)));
  }

  function updateProfile<K extends keyof CVDocument["profile"]>(key: K, value: CVDocument["profile"][K]) {
    updateDoc((current) => {
      current.profile[key] = value;
      return current;
    });
  }

  function updateSettings(key: keyof CVDocument["settings"], value: string | number) {
    updateDoc((current) => {
      current.settings[key] = value as never;
      return current;
    });
  }

  function updateSection(sectionId: string, updater: (section: SectionDef) => void) {
    updateDoc((current) => {
      const section = current.sections.find((item) => item.id === sectionId);
      if (section) updater(section);
      return current;
    });
  }

  function moveSection(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= orderedSections.length) return;
    updateDoc((current) => {
      const order = orderedSections.map((section) => section.id);
      current.settings.sectionOrder = reorder(order, index, target);
      return current;
    });
  }

  function addSection(label: string) {
    const section = createSection(label);
    updateDoc((current) => {
      current.sections.push(section);
      current.settings.sectionOrder.push(section.id);
      return current;
    });
    setSelectedSectionId(section.id);
    setTab("content");
  }

  function loadDocument(nextDoc: CVDocument, nextFileName?: string, nextHandle?: FileHandle) {
    const normalized = normalizeDocument(nextDoc);
    setDoc(normalized);
    setFileName(nextFileName);
    setFileHandle(nextHandle);
    setSelectedSectionId(normalized.settings.sectionOrder[0] ?? normalized.sections[0]?.id ?? "");
    setContentView("profile");
    setTab("content");
    setStartupOpen(false);
  }

  function startNew(mode: StartMode) {
    const nextDoc = mode === "blank" ? createBlankDocument() : createSampleDocument();
    loadDocument(nextDoc, undefined, undefined);
    setStatus(mode === "blank" ? "Started a blank CV JSON." : "Loaded the John Doe template CV.");
  }

  async function readFile(file: File, handle?: FileHandle) {
    try {
      const parsed = JSON.parse(await file.text()) as CVDocument;
      loadDocument(parsed, file.name, handle);
      setStatus(`Opened ${file.name}`);
    } catch (error) {
      setStatus(`Could not open JSON: ${error instanceof Error ? error.message : "Invalid file"}`);
    }
  }

  async function openJson() {
    const picker = window as BrowserFileWindow;
    if (picker.showOpenFilePicker) {
      try {
        const [handle] = await picker.showOpenFilePicker({
          types: [{ description: "CV JSON", accept: { "application/json": [".json"] } }],
          multiple: false
        });
        if (!handle) return;
        await readFile(await handle.getFile(), handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus(`Could not open JSON: ${error instanceof Error ? error.message : "Picker failed"}`);
        return;
      }
    }
    fileInputRef.current?.click();
  }

  async function saveJson() {
    const content = jsonText(doc);
    if (fileHandle && await writeHandle(fileHandle, content)) {
      setStatus(`Saved ${fileHandle.name}`);
      return;
    }
    await saveJsonAs();
  }

  async function saveJsonAs() {
    const content = jsonText(doc);
    const picker = window as BrowserFileWindow;
    if (picker.showSaveFilePicker) {
      try {
        const handle = await picker.showSaveFilePicker({
          suggestedName: fileName ?? defaultFileName(doc, "json"),
          types: [{ description: "CV JSON", accept: { "application/json": [".json"] } }]
        });
        await writeHandle(handle, content);
        setFileHandle(handle);
        setFileName(handle.name);
        setStatus(`Saved ${handle.name}`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus(`Could not save JSON: ${error instanceof Error ? error.message : "Picker failed"}`);
        return;
      }
    }
    const name = fileName ?? defaultFileName(doc, "json");
    downloadText(name, content, "application/json");
    setFileName(name);
    setStatus(`Downloaded ${name}. Save it somewhere you can find later.`);
  }

  async function exportTex() {
    const content = latex;
    const name = defaultFileName(doc, "tex");
    const picker = window as BrowserFileWindow;
    if (picker.showSaveFilePicker) {
      try {
        const handle = await picker.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "LaTeX", accept: { "application/x-tex": [".tex"], "text/plain": [".tex"] } }]
        });
        await writeHandle(handle, content);
        setStatus(`Saved ${handle.name}`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus(`Could not save LaTeX: ${error instanceof Error ? error.message : "Picker failed"}`);
        return;
      }
    }
    downloadText(name, content, "application/x-tex");
    setStatus(`Downloaded ${name}`);
  }

  function exportPdf() {
    setTab("preview");
    setStatus("Use the browser print dialog to save the CV as a PDF.");
    window.setTimeout(() => window.print(), 160);
  }

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void readFile(file);
        }}
      />
      <aside className="sidebar">
        <div className="brand">
          <FileText size={24} />
          <div>
            <h1>Academic CV Generator</h1>
            <p>GitHub Pages JSON editor</p>
          </div>
          <button
            className="collapse-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="nav-tabs" aria-label="Main views">
          <button title="Content" className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}><LayoutList size={17} /> <span>Content</span></button>
          <button title="Sections" className={tab === "sections" ? "active" : ""} onClick={() => setTab("sections")}><Settings size={17} /> <span>Sections</span></button>
          <button title="Preview" className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}><Eye size={17} /> <span>Preview</span></button>
        </nav>

        <button
          className={tab === "content" && contentView === "profile" ? "profile-pill active" : "profile-pill"}
          onClick={() => {
            setContentView("profile");
            setTab("content");
          }}
          title="Profile"
        >
          <FileText size={16} />
          <span>Profile</span>
        </button>

        <details className="collapsed-section-menu">
          <summary aria-label="Open section navigator" title="Sections">
            <LayoutList size={17} />
          </summary>
          <div className="collapsed-section-popout">
            <label className="field">
              <span>Content</span>
              <select
                value={contentView === "profile" ? "__profile" : selectedSectionId}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (value === "__profile") {
                    setContentView("profile");
                  } else {
                    setSelectedSectionId(value);
                    setContentView("section");
                  }
                  setTab("content");
                }}
              >
                <option value="__profile">Profile</option>
                {orderedSections.map((section) => (
                  <option key={section.id} value={section.id}>{section.title}</option>
                ))}
              </select>
            </label>
          </div>
        </details>

        <div className="section-list">
          {orderedSections.map((section, index) => (
            <button
              key={section.id}
              className={tab === "content" && contentView === "section" && selectedSection?.id === section.id ? "section-pill active" : "section-pill"}
              title={section.title}
              onClick={() => {
                setSelectedSectionId(section.id);
                setContentView("section");
                if (tab === "preview") setTab("content");
              }}
            >
              <span>{section.title}</span>
              <small>{section.items.length || "empty"}</small>
              <div className="reorder">
                <ArrowUp size={14} onClick={(event) => { event.stopPropagation(); moveSection(index, -1); }} />
                <ArrowDown size={14} onClick={(event) => { event.stopPropagation(); moveSection(index, 1); }} />
              </div>
            </button>
          ))}
        </div>

        <div className="add-section">
          <select aria-label="Section template" onChange={(event) => event.currentTarget.value && addSection(event.currentTarget.value)} value="">
            <option value="">Add section...</option>
            {sectionTemplates.map((template) => <option key={template.label} value={template.label}>{template.label}</option>)}
          </select>
        </div>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div className="path">
            <FileJson size={18} />
            <span>{fileName ?? "Unsaved JSON"}</span>
          </div>
          <div className="actions">
            <button onClick={openJson}><FolderOpen size={16} /> Upload</button>
            <button onClick={saveJson}><Save size={16} /> Save</button>
            <button onClick={saveJsonAs}>Save As</button>
            <button onClick={exportTex}><Download size={16} /> .tex</button>
            <button className="primary" onClick={exportPdf}><Printer size={16} /> PDF</button>
          </div>
        </header>

        <div className="status-row">
          <div className="status">{status}</div>
          <div className="app-meta">
            <span>Static web app</span>
            <span>Local files only</span>
            <span>GitHub Pages</span>
          </div>
        </div>

        {tab === "content" && (
          contentView === "profile" ? (
            <section className="panel profile-panel">
              <ProfileEditor doc={doc} updateProfile={updateProfile} updateSettings={updateSettings} />
            </section>
          ) : selectedSection ? (
            <section className="panel section-editor">
              <SectionEditor section={selectedSection} updateSection={updateSection} />
            </section>
          ) : (
            <section className="panel">
              <div className="empty-state">No sections yet. Add a section from the sidebar to start editing content.</div>
            </section>
          )
        )}

        {tab === "sections" && (
          <section className="panel">
            <SchemaEditor
              sections={orderedSections}
              selectedSectionId={selectedSectionId}
              setSelectedSectionId={setSelectedSectionId}
              updateSection={updateSection}
              updateDoc={updateDoc}
            />
          </section>
        )}

        {tab === "preview" && (
          <div className="preview-layout">
            <ScaledPaperPreview doc={doc} sections={outputSections} />
            <section className="latex-panel">
              <h2>Generated LaTeX</h2>
              <textarea readOnly value={latex} />
            </section>
          </div>
        )}
      </main>
      {startupOpen && (
        <div className="startup-overlay" role="dialog" aria-modal="true" aria-labelledby="startup-title">
          <section className="startup-panel">
            <div className="startup-heading">
              <FileJson size={26} />
              <div>
                <h2 id="startup-title">Start with a CV JSON</h2>
                <p>Create a local JSON file, start from a filled template, or upload one you already have.</p>
              </div>
            </div>
            <div className="startup-actions">
              <button type="button" onClick={() => startNew("blank")}>
                <FilePlus size={20} />
                <span>Blank JSON</span>
              </button>
              <button type="button" className="primary" onClick={() => startNew("template")}>
                <Sparkles size={20} />
                <span>Template JSON</span>
              </button>
              <button type="button" onClick={openJson}>
                <FileUp size={20} />
                <span>Upload JSON</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ProfileEditor({
  doc,
  updateProfile,
  updateSettings
}: {
  doc: CVDocument;
  updateProfile: <K extends keyof CVDocument["profile"]>(key: K, value: CVDocument["profile"][K]) => void;
  updateSettings: (key: keyof CVDocument["settings"], value: string | number) => void;
}) {
  const links = doc.profile.links ?? [];

  function updateLink(linkId: string, key: keyof ProfileLink, value: string) {
    updateProfile("links", links.map((link) => link.id === linkId ? { ...link, [key]: value } : link));
  }

  function moveLink(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    updateProfile("links", reorder(links, index, target));
  }

  return (
    <>
      <div className="panel-title">
        <h2>Profile</h2>
        <p>Header details, custom links, and owner names used for bolding citations.</p>
      </div>
      <div className="field-grid">
        <TextInput label="Name" value={doc.profile.name} onChange={(value) => updateProfile("name", value)} />
        <TextInput label="Credentials" value={doc.profile.credentials ?? ""} onChange={(value) => updateProfile("credentials", value)} />
        <TextInput label="Current position" value={doc.profile.title ?? ""} onChange={(value) => updateProfile("title", value)} />
        <TextInput label="Affiliation" value={doc.profile.affiliation ?? ""} onChange={(value) => updateProfile("affiliation", value)} />
        <TextInput label="Address" value={doc.profile.address ?? doc.profile.location ?? ""} onChange={(value) => updateProfile("address", value)} />
        <TextInput label="Email" value={doc.profile.email ?? ""} onChange={(value) => updateProfile("email", value)} />
        <TextInput label="Phone" value={doc.profile.phone ?? ""} onChange={(value) => updateProfile("phone", value)} />
        <TextInput label="Margin inches" value={String(doc.settings.marginInches)} onChange={(value) => updateSettings("marginInches", Number(value) || 0.75)} />
        <TextArea label="Owner name variants" value={doc.profile.ownerNames.join("\n")} onChange={(value) => updateProfile("ownerNames", listValue(value))} />
      </div>

      <div className="profile-links">
        <div className="subsection-title">
          <h3>Header Links</h3>
          <button onClick={() => updateProfile("links", [...links, createProfileLink()])}><Plus size={16} /> Add link</button>
        </div>
        <div className="profile-link-list">
          {links.map((link, index) => (
            <div className="profile-link-row" key={link.id}>
              <TextInput label="Label" value={link.label} onChange={(value) => updateLink(link.id, "label", value)} />
              <TextInput label="URL" value={link.url} onChange={(value) => updateLink(link.id, "url", value)} />
              <div className="profile-link-actions">
                <button aria-label="Move link up" onClick={() => moveLink(index, -1)}><ArrowUp size={15} /></button>
                <button aria-label="Move link down" onClick={() => moveLink(index, 1)}><ArrowDown size={15} /></button>
                <button aria-label="Remove link" onClick={() => updateProfile("links", links.filter((item) => item.id !== link.id))}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SectionEditor({
  section,
  updateSection
}: {
  section: SectionDef;
  updateSection: (sectionId: string, updater: (section: SectionDef) => void) => void;
}) {
  function updateItem(itemId: string, field: FieldDef, rawValue: string) {
    updateSection(section.id, (current) => {
      const item = current.items.find((entry) => entry.id === itemId);
      if (!item) return;
      item.values[field.id] = field.kind === "authors"
        ? listValue(rawValue)
        : field.kind === "bullets" || field.kind === "tags"
          ? listValue(rawValue, true)
          : rawValue;
    });
  }

  return (
    <>
      <div className="panel-title split">
        <div>
          <h2>{section.title}</h2>
          <p>{section.hiddenWhenEmpty ? "Hidden from output while empty." : "Always shown in output."}</p>
        </div>
        <button className="primary" onClick={() => updateSection(section.id, (current) => current.items.unshift(createItem(current)))}>
          <Plus size={16} /> Add item
        </button>
      </div>

      <div className="section-title-editor">
        <TextInput
          label="Section title"
          value={section.title}
          onChange={(value) => updateSection(section.id, (current) => { current.title = value; })}
        />
      </div>

      {section.items.length === 0 && <div className="empty-state">No entries yet. Add an item when this section becomes relevant.</div>}
      <div className="item-stack">
        {section.items.map((item, index) => (
          <article className="entry-card" key={item.id}>
            <div className="entry-toolbar">
              <strong>Entry {index + 1}</strong>
              <div>
                <button aria-label="Move entry up" onClick={() => updateSection(section.id, (current) => { if (index > 0) current.items = reorder(current.items, index, index - 1); })}><ArrowUp size={15} /></button>
                <button aria-label="Move entry down" onClick={() => updateSection(section.id, (current) => { if (index < current.items.length - 1) current.items = reorder(current.items, index, index + 1); })}><ArrowDown size={15} /></button>
                <button aria-label="Delete entry" onClick={() => updateSection(section.id, (current) => { current.items = current.items.filter((entry) => entry.id !== item.id); })}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="field-grid">
              {section.fields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  item={item}
                  onChange={(value) => updateItem(item.id, field, value)}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function FieldInput({ field, item, onChange }: { field: FieldDef; item: SectionItem; onChange: (value: string) => void }) {
  const value = valueToText(item.values[field.id]);
  if (field.kind === "textarea" || field.kind === "authors" || field.kind === "bullets" || field.kind === "tags") {
    return (
      <TextArea
        label={field.label}
        value={value}
        onChange={onChange}
        placeholder={field.kind === "authors" ? "One author per line" : field.kind === "bullets" ? "One bullet per line" : field.placeholder}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
          <option value="">Select...</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  return <TextInput label={field.label} value={value} onChange={onChange} placeholder={field.placeholder} />;
}

function SchemaEditor({
  sections,
  selectedSectionId,
  setSelectedSectionId,
  updateSection,
  updateDoc
}: {
  sections: SectionDef[];
  selectedSectionId: string;
  setSelectedSectionId: (id: string) => void;
  updateSection: (sectionId: string, updater: (section: SectionDef) => void) => void;
  updateDoc: (updater: (current: CVDocument) => CVDocument) => void;
}) {
  const section = sections.find((item) => item.id === selectedSectionId) ?? sections[0];
  if (!section) return null;

  function removeField(fieldId: string) {
    updateSection(section.id, (current) => {
      current.fields = current.fields.filter((field) => field.id !== fieldId);
      current.items.forEach((item) => delete item.values[fieldId]);
    });
  }

  return (
    <>
      <div className="panel-title">
        <h2>Section Schema</h2>
        <p>Change the fields that entries in each section should collect.</p>
      </div>
      <div className="schema-layout">
        <div className="schema-list">
          {sections.map((item) => (
            <button key={item.id} className={item.id === section.id ? "active" : ""} onClick={() => setSelectedSectionId(item.id)}>
              {item.title}
            </button>
          ))}
        </div>
        <div className="schema-fields">
          <div className="field-grid">
            <TextInput label="Section title" value={section.title} onChange={(value) => updateSection(section.id, (current) => { current.title = value; })} />
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={section.hiddenWhenEmpty}
                onChange={(event) => updateSection(section.id, (current) => { current.hiddenWhenEmpty = event.currentTarget.checked; })}
              />
              <span>Hide this section when it has no entries</span>
            </label>
          </div>

          <div className="schema-toolbar">
            <button onClick={() => updateSection(section.id, (current) => current.fields.push(createField()))}><Plus size={16} /> Add field</button>
            <button className="danger" onClick={() => updateDoc((current) => {
              current.sections = current.sections.filter((item) => item.id !== section.id);
              current.settings.sectionOrder = current.settings.sectionOrder.filter((id) => id !== section.id);
              return current;
            })}><Trash2 size={16} /> Delete section</button>
          </div>

          <div className="field-definition-list">
            {section.fields.map((field, index) => (
              <div className="field-definition" key={field.id}>
                <TextInput label="Label" value={field.label} onChange={(value) => updateSection(section.id, (current) => { current.fields[index].label = value; })} />
                <label className="field">
                  <span>Type</span>
                  <select value={field.kind} onChange={(event) => updateSection(section.id, (current) => { current.fields[index].kind = event.currentTarget.value as FieldKind; })}>
                    {fieldKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                </label>
                <TextInput label="Placeholder" value={field.placeholder ?? ""} onChange={(value) => updateSection(section.id, (current) => { current.fields[index].placeholder = value; })} />
                <div className="definition-actions">
                  <button aria-label="Move field up" onClick={() => updateSection(section.id, (current) => { if (index > 0) current.fields = reorder(current.fields, index, index - 1); })}><ArrowUp size={15} /></button>
                  <button aria-label="Move field down" onClick={() => updateSection(section.id, (current) => { if (index < current.fields.length - 1) current.fields = reorder(current.fields, index, index + 1); })}><ArrowDown size={15} /></button>
                  <button aria-label="Remove field" onClick={() => removeField(field.id)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ScaledPaperPreview({ doc, sections }: { doc: CVDocument; sections: SectionDef[] }) {
  const containerRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const pageWidth = doc.settings.paperSize === "a4" ? 794 : 816;
  const pageHeight = doc.settings.paperSize === "a4" ? 1123 : 1056;
  const marginPx = Math.max(24, Math.min(144, (doc.settings.marginInches || 0.75) * 96));
  const [paperState, setPaperState] = useState({ scale: 1, height: pageHeight });

  useEffect(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;

    const measure = () => {
      const availableWidth = Math.max(1, container.clientWidth - 4);
      const scale = Math.min(1, availableWidth / pageWidth);
      const height = Math.max(pageHeight, page.scrollHeight);
      setPaperState((current) => (
        Math.abs(current.scale - scale) < 0.001 && Math.abs(current.height - height) < 1
          ? current
          : { scale, height }
      ));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(page);
    return () => observer.disconnect();
  }, [doc, pageHeight, pageWidth, sections]);

  return (
    <section className="paper-preview" ref={containerRef}>
      <div
        className="paper-stage"
        style={{
          width: `${pageWidth * paperState.scale}px`,
          height: `${paperState.height * paperState.scale}px`
        }}
      >
        <CvPreview
          doc={doc}
          sections={sections}
          pageRef={pageRef}
          style={{
            width: `${pageWidth}px`,
            minHeight: `${pageHeight}px`,
            padding: `${marginPx}px`,
            transform: `scale(${paperState.scale})`
          }}
        />
      </div>
    </section>
  );
}

function CvPreview({
  doc,
  sections,
  pageRef,
  style
}: {
  doc: CVDocument;
  sections: SectionDef[];
  pageRef?: RefObject<HTMLDivElement | null>;
  style?: CSSProperties;
}) {
  const address = doc.profile.address || doc.profile.location || "";
  const contact = [doc.profile.email, doc.profile.phone].filter(Boolean);
  const links = profileLinks(doc.profile);

  return (
    <div className="cv-page" ref={pageRef} style={style}>
      <header className="cv-header">
        <h1>{doc.profile.name}{doc.profile.credentials ? `, ${doc.profile.credentials}` : ""}</h1>
        {doc.profile.title && <p>{doc.profile.title}</p>}
        {doc.profile.affiliation && <p>{doc.profile.affiliation}</p>}
        {address && <p>{address}</p>}
        {contact.length > 0 && <small>{contact.join(" · ")}</small>}
        {links.length > 0 && (
          <small>
            {links.map((link, index) => (
              <span key={link.id}>{index > 0 ? " · " : ""}<a href={link.url}>{link.label}</a></span>
            ))}
          </small>
        )}
      </header>
      {sections.map((section) => (
        <section className="cv-section" key={section.id}>
          <h2>{section.title}</h2>
          {isCitationSection(section) ? (
            <ol className="cv-citation-list">
              {section.items.filter(itemHasContent).map((item) => <CitationPreviewItem key={item.id} section={section} item={item} ownerNames={doc.profile.ownerNames} />)}
            </ol>
          ) : (
            <div className={section.kind === "certifications" ? "cv-cert-grid" : undefined}>
              {(section.kind === "certifications" ? sortYearDesc(section.items) : section.items)
                .filter(itemHasContent)
                .map((item) => <PreviewItem key={item.id} section={section} item={item} ownerNames={doc.profile.ownerNames} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CitationPreviewItem({ section, item, ownerNames }: { section: SectionDef; item: SectionItem; ownerNames: string[] }) {
  const authors = itemList(item, "authors").map((author) => ownerNames.includes(author) || ownerNames.some((owner) => author.includes(owner)) ? <strong key={author}>{author}</strong> : <span key={author}>{author}</span>);
  const isPresentation = section.kind === "presentation" || /\b(poster|podium|abstract|presentation)s?\b/.test(sectionText(section));
  const meeting = itemText(item, "meeting") || itemText(item, "conference") || itemText(item, "venue");
  const venue = isPresentation
    ? meeting ? `${presentationType(section, item)} presented at ${meeting}` : ""
    : itemText(item, "venue") || itemText(item, "book") || itemText(item, "meeting");
  const details = itemText(item, "details") || itemText(item, "publisher");
  const doi = itemText(item, "doi");

  return (
    <li>
      {authors.map((node, index) => <span key={index}>{index > 0 ? ", " : ""}{node}</span>)}
      {itemText(item, "year") && <> ({itemText(item, "year")}).</>}
      {itemText(item, "title") && <> <em>{itemText(item, "title")}</em>.</>}
      {venue && <> {venue}.</>}
      {isPresentation && itemText(item, "location") && <> {itemText(item, "location")}.</>}
      {details && <> {details}.</>}
      {doi && <> {doi}.</>}
    </li>
  );
}

function PreviewItem({ section, item, ownerNames }: { section: SectionDef; item: SectionItem; ownerNames: string[] }) {
  if (section.kind === "publication" || section.kind === "presentation") {
    const authors = itemList(item, "authors").map((author) => ownerNames.includes(author) || ownerNames.some((owner) => author.includes(owner)) ? <strong key={author}>{author}</strong> : <span key={author}>{author}</span>);
    return (
      <div className="cv-item">
        <p>{itemText(item, "type") && `[${itemText(item, "type")}] `}{authors.map((node, index) => <span key={index}>{index > 0 ? ", " : ""}{node}</span>)} {itemText(item, "year") && `(${itemText(item, "year")}).`} <em>{itemText(item, "title")}</em>. {itemText(item, "venue") || itemText(item, "meeting") || itemText(item, "book")} {itemText(item, "details") || itemText(item, "publisher")}</p>
      </div>
    );
  }
  if (section.kind === "skills") {
    return <div className="cv-item"><p><strong>{itemText(item, "category") || "Skills"}:</strong> {itemList(item, "items").join(", ")}</p></div>;
  }
  if (section.kind === "certifications") {
    return (
      <div className="cv-cert-item">
        <strong>{itemText(item, "name")}</strong>
        <span>{[itemText(item, "issuer"), itemText(item, "year") || itemText(item, "date")].filter(Boolean).join(", ")}</span>
      </div>
    );
  }
  if (section.kind === "education") return <EducationPreview item={item} />;
  if (section.kind === "experience") return <ExperiencePreview item={item} />;
  if (section.kind === "appointments") return <AppointmentPreview item={item} />;
  if (section.kind === "volunteer") return <VolunteerPreview item={item} />;
  return <CompactPreview section={section} item={item} />;
}

function EntryRow({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  if (!left && !right) return null;
  return (
    <div className="cv-entry-row">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function BulletPreview({ items }: { items: string[] }) {
  return items.length ? <ul>{items.map((entry) => <li key={entry}>{entry}</li>)}</ul> : null;
}

function EducationPreview({ item }: { item: SectionItem }) {
  const degree = firstItemText(item, ["degree", "program"]);
  const field = firstItemText(item, ["field", "specialty", "concentration"]);
  const degreeText = [degree, field].filter(Boolean).join(degree && field ? " in " : "");
  const gpa = itemText(item, "gpa");
  return (
    <div className="cv-item">
      <EntryRow left={<strong>{firstItemText(item, ["institution", "school", "program"])}</strong>} right={itemText(item, "location")} />
      <EntryRow
        left={<em>{degreeText}{gpa && <> (GPA: <strong>{gpa}</strong>)</>}</em>}
        right={itemText(item, "dates") && <em>{itemText(item, "dates")}</em>}
      />
      <BulletPreview items={itemList(item, "details", true)} />
    </div>
  );
}

function ExperiencePreview({ item }: { item: SectionItem }) {
  return (
    <div className="cv-item">
      <EntryRow left={<strong>{firstItemText(item, ["organization", "company", "institution"])}</strong>} right={itemText(item, "location")} />
      <EntryRow left={firstItemText(item, ["role", "title", "position"]) && <em>{firstItemText(item, ["role", "title", "position"])}</em>} right={itemText(item, "dates") && <em>{itemText(item, "dates")}</em>} />
      {firstItemText(item, ["summary", "description", "impact"]) && <p>{firstItemText(item, ["summary", "description", "impact"])}</p>}
      <BulletPreview items={itemList(item, "bullets", true)} />
    </div>
  );
}

function AppointmentPreview({ item }: { item: SectionItem }) {
  return (
    <div className="cv-item">
      <EntryRow left={<strong>{firstItemText(item, ["appointment", "name", "project"])}</strong>} right={<strong>{firstItemText(item, ["affiliation", "organization", "institution"])}</strong>} />
      <EntryRow left={firstItemText(item, ["role", "title", "position"]) && <em>{firstItemText(item, ["role", "title", "position"])}</em>} right={itemText(item, "dates") && <em>{itemText(item, "dates")}</em>} />
      {firstItemText(item, ["description", "summary"]) && <p>{firstItemText(item, ["description", "summary"])}</p>}
    </div>
  );
}

function VolunteerPreview({ item }: { item: SectionItem }) {
  return (
    <div className="cv-item">
      <EntryRow left={<strong>{firstItemText(item, ["organization", "area"])}</strong>} right={<strong>{firstItemText(item, ["location", "organizations"])}</strong>} />
      <EntryRow left={firstItemText(item, ["role", "title"]) && <em>{firstItemText(item, ["role", "title"])}</em>} right={itemText(item, "dates") && <em>{itemText(item, "dates")}</em>} />
      {firstItemText(item, ["impact", "summary", "description"]) && <p>{firstItemText(item, ["impact", "summary", "description"])}</p>}
      <BulletPreview items={itemList(item, "bullets", true)} />
      {itemText(item, "hours") && <p><em>{itemText(item, "hours")} hours</em></p>}
    </div>
  );
}

function CompactPreview({ section, item }: { section: SectionDef; item: SectionItem }) {
  const primaryField = section.fields[0];
  const secondaryField = section.fields[1];
  const dateField = section.fields.find((field) => field.kind === "dateRange" || field.id === "date" || field.id === "year");
  const locationField = section.fields.find((field) => field.id === "location" || field.id === "state");
  const skipped = [primaryField?.id, secondaryField?.id, dateField?.id, locationField?.id];
  return (
    <div className="cv-item">
      <EntryRow left={<strong>{itemText(item, primaryField?.id ?? "")}</strong>} right={[itemText(item, locationField?.id ?? ""), itemText(item, dateField?.id ?? "")].filter(Boolean).join(", ")} />
      {itemText(item, secondaryField?.id ?? "") && <p><em>{itemText(item, secondaryField?.id ?? "")}</em></p>}
      {section.fields.filter((field) => !skipped.includes(field.id)).map((field) => {
        const value = item.values[field.id];
        if (field.kind === "bullets") return <BulletPreview key={field.id} items={listValue(value, true)} />;
        if (field.kind === "tags") return <p key={field.id}><em>{listValue(value, true).join(", ")}</em></p>;
        return itemText(item, field.id) ? <p key={field.id}>{itemText(item, field.id)}</p> : null;
      })}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field wide">
      <span>{label}</span>
      <textarea rows={4} value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}
