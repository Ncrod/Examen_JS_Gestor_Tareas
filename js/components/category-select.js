const NEW_VALUE = "__new__";

const template = document.createElement("template");

template.innerHTML = `
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: grid;
      gap: var(--space-2);
    }

    [hidden] {
      display: none !important;
    }

    label {
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    select,
    input {
      width: 100%;
      height: 42px;
      padding: 9px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-button);
      background: var(--color-surface-raised);
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-button);
      color-scheme: dark;
    }

    select:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
    }

    input[aria-invalid="true"] {
      border-color: var(--color-danger);
    }

    .error {
      margin: 0;
      color: var(--color-danger);
      font-size: var(--font-size-sm);
    }
  </style>

  <label for="select">Categoría</label>
  <select id="select"></select>
  <input class="new-name" type="text" maxlength="40" autocomplete="off" placeholder="Nombre de la nueva categoría" aria-label="Nombre de la nueva categoría" hidden>
  <p class="error" role="alert" hidden></p>
`;


class CategorySelect extends HTMLElement {
  #categories = [];

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(template.content.cloneNode(true));

    const root = this.shadowRoot;
    this.selectEl = root.querySelector("select");
    this.newInput = root.querySelector(".new-name");
    this.errorEl = root.querySelector(".error");

    this.selectEl.addEventListener("change", () => {
      this.#clearError();
      this.newInput.hidden = this.selectEl.value !== NEW_VALUE;

      if (!this.newInput.hidden) {
        this.newInput.focus();
      }
    });

    this.newInput.addEventListener("input", () => this.#clearError());
  }

  set categories(value) {
    this.#categories = Array.isArray(value) ? value : [];
    this.#renderOptions();
  }

  get value() {
    return this.selectEl.value;
  }

  set value(id) {
    const exists = this.#categories.some((category) => category.id === id);

    this.selectEl.value = exists ? id : this.#categories[0]?.id ?? NEW_VALUE;
    this.newInput.value = "";
    this.newInput.hidden = this.selectEl.value !== NEW_VALUE;
    this.#clearError();
  }

  focus() {
    this.selectEl.focus();
  }

  read() {
    if (this.selectEl.value !== NEW_VALUE) {
      return { categoryId: this.selectEl.value, newCategory: null };
    }

    const name = this.newInput.value.trim();

    if (!name) {
      this.errorEl.textContent = "Escribe el nombre de la categoría.";
      this.errorEl.hidden = false;
      this.newInput.setAttribute("aria-invalid", "true");
      this.newInput.focus();
      return null;
    }

    return { categoryId: null, newCategory: name };
  }

  #renderOptions() {
    const options = this.#categories.map((category) => {
      const option = document.createElement("option");

      option.value = category.id;
      option.textContent = category.name;

      return option;
    });

    const create = document.createElement("option");

    create.value = NEW_VALUE;
    create.textContent = "+ Nueva categoría...";

    this.selectEl.replaceChildren(...options, create);
  }

  #clearError() {
    this.errorEl.textContent = "";
    this.errorEl.hidden = true;
    this.newInput.removeAttribute("aria-invalid");
  }
}

if (!customElements.get("category-select")) {
  customElements.define("category-select", CategorySelect);
}
