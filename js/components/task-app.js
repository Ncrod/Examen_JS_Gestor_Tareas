import "./task-list.js";
import "./task-form-modal.js";
import "./task-detail-modal.js";
import "./import-modal.js";
import "./confirm-dialog.js";
import "./toast-message.js";
import "./category-manager-modal.js";
import { getTasks } from "../services/storage-service.js";
import {
  addCategory,
  deleteCategory,
  findOrCreateCategory,
  getAllCategories,
  getTaskCategoryId,
  getUserCategories,
  updateCategory,
} from "../services/category-service.js";
import { addImportedTasks, addTask, clearAll, deleteTask, toggleTask, updateTask } from "../services/task-service.js";

// <task-app> no dibuja nada: el HTML está en index.html y los estilos en css/app.css.
// Este componente solo conecta los botones y los eventos con los servicios.

// Pasa a minúsculas y quita las tildes: "Camión" -> "camion"
function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

class TaskApp extends HTMLElement {
  // Lista completa de tareas (viene del localStorage)
  #tasks = [];

  // Filtro por estado: "all" | "pending" | "completed"
  #filter = "all";

  // Filtro por categoría: "all" | id de categoría (incluye "none" e "imported")
  #categoryFilter = "all";

  // Texto del buscador
  #search = "";

  // Para conectar los eventos una sola vez
  #ready = false;

  connectedCallback() {
    if (!this.#ready) {
      this.#setup();
      this.#ready = true;
    }

    document.addEventListener("click", this.#onDocumentClick);
    this.#loadTasks();
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.#onDocumentClick);
  }

  // Busca los elementos que están en index.html y conecta sus eventos
  #setup() {
    this.summary = this.querySelector(".summary");
    this.searchInput = this.querySelector(".search-input");
    this.addButton = this.querySelector(".add");
    this.importButton = this.querySelector(".import");
    this.filterButton = this.querySelector(".filter");
    this.filterMenu = this.querySelector(".filter-menu:not(.category-menu)");
    this.filterOptions = this.filterMenu.querySelectorAll(".filter-option");
    this.categoryButton = this.querySelector(".category-button");
    this.categoryLabel = this.querySelector(".category-label");
    this.categoryMenu = this.querySelector(".category-menu");
    this.categoryManager = this.querySelector("category-manager-modal");
    this.clearButton = this.querySelector(".clear");
    this.list = this.querySelector("task-list");
    this.formModal = this.querySelector("task-form-modal");
    this.detailModal = this.querySelector("task-detail-modal");
    this.importModal = this.querySelector("import-modal");
    this.confirmDialog = this.querySelector("confirm-dialog");
    this.toast = this.querySelector("toast-message");

    this.addButton.addEventListener("click", () => this.formModal.open({ categories: getAllCategories() }));
    this.formModal.addEventListener("task-save", (event) => this.#onTaskSave(event));

    this.searchInput.addEventListener("input", () => {
      this.#search = this.searchInput.value;
      this.#render();
    });

    this.filterButton.addEventListener("click", () => this.#toggleFilterMenu());
    this.filterOptions.forEach((option) => {
      option.addEventListener("click", () => this.#setFilter(option.dataset.filter));
    });
    this.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.filterMenu.hidden) {
        this.#closeFilterMenu();
        this.filterButton.focus();
      } else if (event.key === "Escape" && !this.categoryMenu.hidden) {
        this.#closeCategoryMenu();
        this.categoryButton.focus();
      }
    });

    // Popup de categorías
    this.categoryButton.addEventListener("click", () => this.#toggleCategoryMenu());
    this.categoryMenu.addEventListener("click", (event) => this.#onCategoryMenuClick(event));
    this.categoryManager.addEventListener("category-add", (event) => this.#onCategoryAdd(event));
    this.categoryManager.addEventListener("category-rename", (event) => this.#onCategoryRename(event));
    this.categoryManager.addEventListener("category-delete", (event) => this.#onCategoryDelete(event));

    this.importButton.addEventListener("click", () => this.importModal.open({ categories: getAllCategories() }));
    this.clearButton.addEventListener("click", () => this.#onClear());
    this.importModal.addEventListener("tasks-import", (event) => this.#onTasksImport(event));

    // Eventos que salen de cada <task-item> (burbujean hasta la lista)
    this.list.addEventListener("task-toggle", (event) => this.#onTaskToggle(event));
    this.detailModal.addEventListener("task-edit", (event) => this.#onTaskEdit(event));
    this.list.addEventListener("task-view", (event) => this.#onTaskView(event));
    this.list.addEventListener("task-edit", (event) => this.#onTaskEdit(event));
    this.list.addEventListener("task-delete", (event) => this.#onTaskDelete(event));
  }

  // Lee las tareas guardadas y vuelve a dibujar
  #loadTasks() {
    this.#tasks = getTasks();
    this.#render();
  }

  // ---------- Popup del filtro ----------

  // Cierra el popup del filtro al hacer clic fuera de él
  #onDocumentClick = (event) => {
    const path = event.composedPath();

    if (!path.includes(this.filterMenu) && !path.includes(this.filterButton)) {
      this.#closeFilterMenu();
    }

    if (!path.includes(this.categoryMenu) && !path.includes(this.categoryButton)) {
      this.#closeCategoryMenu();
    }
  };

  #toggleFilterMenu() {
    if (this.filterMenu.hidden) {
      this.filterMenu.hidden = false;
      this.filterButton.setAttribute("aria-expanded", "true");

      // El foco pasa a la opción activa
      this.filterMenu.querySelector('[aria-checked="true"]').focus();
    } else {
      this.#closeFilterMenu();
    }
  }

  #closeFilterMenu() {
    this.filterMenu.hidden = true;
    this.filterButton.setAttribute("aria-expanded", "false");
  }

  // Elige un filtro, marca la opción activa y cierra el popup
  #setFilter(filter) {
    this.#filter = filter;

    this.filterOptions.forEach((option) => {
      option.setAttribute("aria-checked", String(option.dataset.filter === filter));
    });

    this.#closeFilterMenu();
    this.filterButton.focus();
    this.#render();
  }

  // ---------- Popup de categorías ----------

  #toggleCategoryMenu() {
    if (!this.categoryMenu.hidden) {
      this.#closeCategoryMenu();
      return;
    }

    this.#renderCategoryMenu();
    this.categoryMenu.hidden = false;
    this.categoryButton.setAttribute("aria-expanded", "true");
    this.categoryMenu.querySelector('[aria-checked="true"]')?.focus();
  }

  #closeCategoryMenu() {
    this.categoryMenu.hidden = true;
    this.categoryButton.setAttribute("aria-expanded", "false");
  }

  // Opciones: Todas, Sin categoría, Importadas, las del usuario y "Gestionar categorías"
  #renderCategoryMenu() {
    const option = (text, filter) => {
      const button = document.createElement("button");
      const label = document.createElement("span");

      label.textContent = text;
      button.className = "filter-option";
      button.type = "button";
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String(filter === this.#categoryFilter));
      button.dataset.category = filter;
      button.append(label);

      return button;
    };

    const separator = document.createElement("div");
    separator.className = "menu-separator";
    separator.setAttribute("role", "separator");

    const manage = document.createElement("button");
    manage.className = "filter-option manage-option";
    manage.type = "button";
    manage.setAttribute("role", "menuitem");
    manage.dataset.manage = "true";
    manage.textContent = "Gestionar categorías...";

    this.categoryMenu.replaceChildren(
      option("Todas", "all"),
      ...getAllCategories().map((category) => option(category.name, category.id)),
      separator,
      manage
    );
  }

  #onCategoryMenuClick(event) {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

    this.#closeCategoryMenu();

    if (button.dataset.manage) {
      this.categoryManager.categories = getUserCategories();
      this.categoryManager.open();
    } else {
      this.#categoryFilter = button.dataset.category;
      this.categoryButton.focus();
      this.#render();
    }
  }

  // Nombre de la categoría seleccionada, para el botón del menú
  #renderCategoryButton() {
    const current = getAllCategories().find((category) => category.id === this.#categoryFilter);

    this.categoryLabel.textContent = `Categoría: ${current ? current.name : "Todas"}`;
  }

  // Crea una categoría desde el gestor
  #onCategoryAdd(event) {
    const result = addCategory(event.detail.name);

    if (result.error) {
      this.categoryManager.showError(result.error);
      return;
    }

    this.categoryManager.showError("");
    this.categoryManager.clearNewInput();
    this.categoryManager.categories = getUserCategories();
    this.toast.show("Categoría creada");
    this.#render();
  }

  // Renombra una categoría desde el gestor
  #onCategoryRename(event) {
    const result = updateCategory(event.detail.id, event.detail.name);

    if (result.error) {
      this.categoryManager.showError(result.error);
      return;
    }

    this.categoryManager.showError("");
    this.categoryManager.categories = getUserCategories();
    this.toast.show("Categoría actualizada");
    this.#render();
  }

  // Elimina una categoría desde el gestor: sus tareas pasan a "Sin categoría"
  async #onCategoryDelete(event) {
    const category = getUserCategories().find((item) => item.id === event.detail.id);

    if (!category) {
      return;
    }

    const count = this.#tasks.filter((task) => getTaskCategoryId(task) === category.id).length;
    const effect =
      count === 0
        ? ""
        : ` Sus ${count === 1 ? "1 tarea pasará" : `${count} tareas pasarán`} a "Sin categoría".`;

    const accepted = await this.confirmDialog.open({
      title: "Eliminar categoría",
      message: `¿Quieres eliminar la categoría "${category.name}"?${effect}`,
      confirmText: "Eliminar",
    });

    if (!accepted) {
      return;
    }

    if (deleteCategory(category.id)) {
      this.toast.show("Categoría eliminada");
    } else {
      this.#showSaveError();
    }

    this.#loadTasks();
    this.categoryManager.categories = getUserCategories();
  }

  // Resuelve la categoría elegida en un formulario: una existente, o una nueva (que se crea).
  // Devuelve el id, o null si no se pudo crear (ya muestra el aviso).
  #resolveCategory({ categoryId, newCategory }) {
    if (!newCategory) {
      return categoryId;
    }

    const result = findOrCreateCategory(newCategory);

    if (result.error) {
      this.toast.show(result.error, "error");
      return null;
    }

    return result.category.id;
  }

  // ---------- Acciones sobre las tareas ----------

  // Clic en una tarea: abre el popup con su información
  #onTaskView(event) {
    const task = this.#tasks.find((item) => item.id === event.detail.id);

    if (task) {
      this.detailModal.open({ task: this.#withCategoryName(task) });
    }
  }

  // Opción "Actualizar" de una tarea: abre el formulario con sus datos
  #onTaskEdit(event) {
    const task = this.#tasks.find((item) => item.id === event.detail.id);

    if (task) {
      this.formModal.open({
        task,
        categories: getAllCategories(),
        categoryId: getTaskCategoryId(task),
      });
    }
  }

  // Opción "Eliminar" de una tarea: pide confirmación antes de borrar
  async #onTaskDelete(event) {
    const task = this.#tasks.find((item) => item.id === event.detail.id);

    if (!task) {
      return;
    }

    const accepted = await this.confirmDialog.open({
      title: "Eliminar tarea",
      message: `¿Quieres eliminar "${task.title}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
    });

    if (accepted) {
      if (deleteTask(task.id)) {
        this.toast.show("Tarea eliminada");
      } else {
        this.#showSaveError();
      }

      this.#loadTasks();
    }
  }

  // Botón "Vaciar": pide confirmación antes de borrar todo
  async #onClear() {
    const total = this.#tasks.length;

    // Si no hay tareas no hay nada que vaciar
    if (total === 0) {
      return;
    }

    const accepted = await this.confirmDialog.open({
      title: "Vaciar lista",
      message: `Se ${total === 1 ? "eliminará 1 tarea" : `eliminarán ${total} tareas`} de la lista. Esta acción no se puede deshacer.`,
      confirmText: "Vaciar",
    });

    if (accepted) {
      if (clearAll() === null) {
        this.#showSaveError();
      } else {
        this.toast.show("Lista vaciada");
      }

      this.#loadTasks();
    }
  }

  // Tareas elegidas en el modal de importar (los repetidos se descartan solos)
  #onTasksImport(event) {
    const categoryId = this.#resolveCategory(event.detail);

    if (categoryId === null) {
      return;
    }

    const added = addImportedTasks(event.detail.tasks, categoryId);

    this.#loadTasks();

    if (added === null) {
      this.#showSaveError();
    } else if (added.length === 0) {
      this.toast.show("Esas tareas ya estaban importadas");
    } else {
      const text = added.length === 1 ? "1 tarea importada" : `${added.length} tareas importadas`;
      this.toast.show(text);
    }
  }

  // Guardar desde el formulario: con id actualiza, sin id crea
  #onTaskSave(event) {
    const { id, title, description, createdAt, completed } = event.detail;
    const categoryId = this.#resolveCategory(event.detail);

    // No se pudo crear la categoría nueva: no se guarda la tarea a medias
    if (categoryId === null) {
      return;
    }

    if (id) {
      const updated = updateTask(id, { title, description, completed, categoryId });

      if (updated) {
        this.toast.show("Tarea actualizada");
      } else {
        this.#showSaveError();
      }
    } else {
      const created = addTask({ title, description, createdAt, completed, categoryId });

      if (created) {
        this.toast.show("Tarea creada");
      } else {
        this.#showSaveError();
      }
    }

    this.#loadTasks();
  }

  // Clic en el círculo de una tarea: cambia pendiente <-> terminada
  #onTaskToggle(event) {
    if (!toggleTask(event.detail.id)) {
      this.#showSaveError();
    }

    this.#loadTasks();
  }

  // Aviso cuando el navegador no deja guardar (almacenamiento lleno o desactivado)
  #showSaveError() {
    this.toast.show(
      "No se pudo guardar. Revisa que el navegador permita guardar datos y tenga espacio.",
      "error"
    );
  }

  // ---------- Dibujar la pantalla ----------

  // Dibuja la pantalla con el estado actual
  #render() {
    // Si la categoría filtrada ya no existe (se eliminó), se vuelve a "Todas"
    if (
      this.#categoryFilter !== "all" &&
      !getAllCategories().some((category) => category.id === this.#categoryFilter)
    ) {
      this.#categoryFilter = "all";
    }

    const visible = this.#getVisibleTasks();

    // "Sin resultados" solo si hay tareas pero el filtro o la búsqueda las ocultan todas
    const hasFilters =
      this.#filter !== "all" || this.#categoryFilter !== "all" || this.#search.trim() !== "";

    this.list.filtered = hasFilters && this.#tasks.length > 0;
    this.list.tasks = visible.map((task) => this.#withCategoryName(task));

    this.#renderCategoryButton();
    this.#renderSummary();
  }

  // Copia de la tarea con el nombre de su categoría, solo para mostrarla
  #withCategoryName(task) {
    const id = getTaskCategoryId(task);
    const category = getAllCategories().find((item) => item.id === id);

    return { ...task, categoryName: category ? category.name : "Sin categoría" };
  }

  // Resumen con el total de tareas (sin importar el filtro): "5 tareas · 2 completadas"
  #renderSummary() {
    const total = this.#tasks.length;
    const done = this.#tasks.filter((task) => task.completed).length;

    const totalText = total === 1 ? "1 tarea" : `${total} tareas`;
    const doneText = done === 1 ? "1 completada" : `${done} completadas`;

    const text = `${totalText} · ${doneText}`;

    // Solo se actualiza si cambió, para que el lector de pantalla no repita el aviso
    if (this.summary.textContent !== text) {
      this.summary.textContent = text;
    }
  }

  // Aplica el filtro por estado y después la búsqueda
  #getVisibleTasks() {
    let tasks = this.#tasks;

    if (this.#filter === "pending") {
      tasks = tasks.filter((task) => !task.completed);
    } else if (this.#filter === "completed") {
      tasks = tasks.filter((task) => task.completed);
    }

    if (this.#categoryFilter !== "all") {
      tasks = tasks.filter((task) => getTaskCategoryId(task) === this.#categoryFilter);
    }

    const text = normalize(this.#search.trim());

    if (text !== "") {
      tasks = tasks.filter((task) => normalize(task.title).includes(text));
    }

    return tasks;
  }
}

if (!customElements.get("task-app")) {
  customElements.define("task-app", TaskApp);
}
