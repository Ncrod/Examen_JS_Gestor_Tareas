const template = document.createElement("template");

template.innerHTML = `
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      --modal-padding: var(--space-4);
    }

    @media (min-width: 480px) {
      :host {
        --modal-padding: var(--space-6);
      }
    }

    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }

    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    [hidden] {
      display: none !important;
    }

    dialog {
      width: min(560px, calc(100vw - 2rem));
      max-height: min(80vh, 640px);
      padding: 0;
      color: var(--color-text);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
    }

    dialog[open] {
      display: flex;
      flex-direction: column;
    }

    dialog::backdrop {
      background: var(--color-overlay, rgba(0, 0, 0, 0.65));
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4) var(--modal-padding);
      border-bottom: 1px solid var(--color-border);
    }

    .header h2 {
      margin: 0;
      font-size: var(--font-size-lg);
    }

    .close {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-text-muted);
    }

    .close:hover {
      background: var(--color-surface-raised);
      color: var(--color-text);
    }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-4) var(--modal-padding);
    }

    .add-form {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }

    input[type="text"] {
      flex: 1;
      min-width: 0;
      height: 42px;
      padding: 9px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-button);
      background: var(--color-surface-raised);
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-button);
    }

    input[aria-invalid="true"] {
      border-color: var(--color-danger);
    }

    .error {
      margin: 0 0 var(--space-3);
      min-height: 1.25em;
      color: var(--color-danger);
      font-size: var(--font-size-sm);
    }

    .list {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-row);
    }

    .row .name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: var(--font-size-sm);
    }

    .row input[type="text"] {
      height: 34px;
      padding: 4px 10px;
    }

    .empty {
      padding: var(--space-6) var(--space-4);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      text-align: center;
    }

    .btn {
      flex: none;
      height: 42px;
      padding: 9px 12px;
      border: none;
      border-radius: var(--radius-button);
      background: var(--color-control);
      color: var(--color-text);
      font-size: var(--font-size-button);
    }

    .btn:hover {
      filter: brightness(1.2);
    }

    .btn.primary {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    .btn.small {
      height: 34px;
      padding: 4px 10px;
      font-size: var(--font-size-sm);
    }

    .btn.danger {
      color: var(--color-danger);
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      padding: var(--space-4) var(--modal-padding);
      border-top: 1px solid var(--color-border);
    }
  </style>

  <dialog aria-labelledby="modal-title">
    <header class="header">
      <h2 id="modal-title">Categorías</h2>
      <button class="close" type="button" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </header>

    <div class="body">
      <form class="add-form" novalidate>
        <input class="new-name" type="text" maxlength="40" autocomplete="off" placeholder="Nueva categoría" aria-label="Nombre de la nueva categoría">
        <button class="btn primary" type="submit">Crear</button>
      </form>
      <p class="error" role="alert"></p>

      <ul class="list"></ul>
      <p class="empty" hidden>Aún no has creado categorías.</p>
    </div>

    <footer class="footer">
      <button class="btn close-btn" type="button">Cerrar</button>
    </footer>
  </dialog>
`;


class CategoryManagerModal extends HTMLElement {
  #categories = [];
  #editingId = null;

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(template.content.cloneNode(true));

    const root = this.shadowRoot;
    this.dialog = root.querySelector("dialog");
    this.addForm = root.querySelector(".add-form");
    this.newInput = root.querySelector(".new-name");
    this.errorEl = root.querySelector(".error");
    this.listEl = root.querySelector(".list");
    this.emptyEl = root.querySelector(".empty");

    root.querySelector(".close").addEventListener("click", () => this.close());
    root.querySelector(".close-btn").addEventListener("click", () => this.close());

    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) {
        this.close();
      }
    });

    this.addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#emit("category-add", { name: this.newInput.value });
    });
    this.newInput.addEventListener("input", () => this.showError(""));

    this.listEl.addEventListener("click", (event) => this.#onListClick(event));
    this.listEl.addEventListener("keydown", (event) => this.#onListKeydown(event));
  }

  set categories(value) {
    this.#categories = Array.isArray(value) ? value : [];

    // Si la que se estaba editando ya no existe, se sale del modo edición
    if (!this.#categories.some((category) => category.id === this.#editingId)) {
      this.#editingId = null;
    }

    this.#render();
  }

  open() {
    if (this.dialog.open) {
      return;
    }

    this.#editingId = null;
    this.newInput.value = "";
    this.showError("");
    this.#render();
    this.dialog.showModal();
    this.newInput.focus();
  }

  close() {
    this.dialog.close();
  }

  get isOpen() {
    return this.dialog.open;
  }

  // Limpia el campo de nueva categoría (se llama cuando se creó bien)
  clearNewInput() {
    this.newInput.value = "";
    this.newInput.focus();
  }

  showError(message) {
    this.errorEl.textContent = message;

    if (message) {
      this.newInput.setAttribute("aria-invalid", "true");
    } else {
      this.newInput.removeAttribute("aria-invalid");
    }
  }

  #emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  #onListClick(event) {
    const button = event.target.closest("button");
    const row = event.target.closest(".row");

    if (!button || !row) {
      return;
    }

    const id = row.dataset.id;

    if (button.classList.contains("edit")) {
      this.#editingId = id;
      this.showError("");
      this.#render();
      this.listEl.querySelector(".row input")?.focus();
    } else if (button.classList.contains("save")) {
      this.#saveEdit(row);
    } else if (button.classList.contains("cancel")) {
      this.#editingId = null;
      this.showError("");
      this.#render();
    } else if (button.classList.contains("delete")) {
      this.#emit("category-delete", { id });
    }
  }

  #onListKeydown(event) {
    const row = event.target.closest(".row");

    if (!row || event.target.tagName !== "INPUT") {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.#saveEdit(row);
    } else if (event.key === "Escape") {
      // Esc cancela la edición sin cerrar el modal
      event.preventDefault();
      event.stopPropagation();
      this.#editingId = null;
      this.showError("");
      this.#render();
    }
  }

  #saveEdit(row) {
    const input = row.querySelector("input");

    this.#emit("category-rename", { id: row.dataset.id, name: input.value });
  }

  #button(text, className, label) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `btn small ${className}`;
    button.textContent = text;
    button.setAttribute("aria-label", label);

    return button;
  }

  #render() {
    const rows = this.#categories.map((category) => {
      const item = document.createElement("li");
      item.className = "row";
      item.dataset.id = category.id;

      if (category.id === this.#editingId) {
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 40;
        input.value = category.name;
        input.setAttribute("aria-label", `Nuevo nombre para ${category.name}`);

        item.append(
          input,
          this.#button("Guardar", "primary save", `Guardar nombre de ${category.name}`),
          this.#button("Cancelar", "cancel", "Cancelar edición")
        );
      } else {
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = category.name;

        item.append(
          name,
          this.#button("Renombrar", "edit", `Renombrar ${category.name}`),
          this.#button("Eliminar", "delete danger", `Eliminar ${category.name}`)
        );
      }

      return item;
    });

    this.listEl.replaceChildren(...rows);
    this.listEl.hidden = rows.length === 0;
    this.emptyEl.hidden = rows.length !== 0;
  }
}

if (!customElements.get("category-manager-modal")) {
  customElements.define("category-manager-modal", CategoryManagerModal);
}
