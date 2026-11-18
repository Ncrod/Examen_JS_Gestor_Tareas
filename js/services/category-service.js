import { generateId } from "../utils/id-generator.js";
import { getCategories, getTasks, saveCategories, saveTasks } from "./storage-service.js";

// Categorías del sistema: no se pueden editar ni eliminar
export const NONE_ID = "none";
export const IMPORTED_ID = "imported";

export const NONE_CATEGORY = { id: NONE_ID, name: "Sin categoría", system: true };
export const IMPORTED_CATEGORY = { id: IMPORTED_ID, name: "Importadas", system: true };

const MAX_NAME_LENGTH = 40;

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Categoría de una tarea. Las tareas viejas sin categoryId:
// importadas -> "Importadas", el resto -> "Sin categoría"
export function getTaskCategoryId(task) {
  return task.categoryId ?? (task.imported ? IMPORTED_ID : NONE_ID);
}

// Categorías del usuario
export function getUserCategories() {
  return getCategories();
}

// Todas las categorías para mostrar en listas: Sin categoría, Importadas y las del usuario
export function getAllCategories() {
  return [NONE_CATEGORY, IMPORTED_CATEGORY, ...getCategories()];
}

// Devuelve { category } o { error }
function validateName(name, ignoreId = null) {
  const clean = typeof name === "string" ? name.trim() : "";

  if (!clean) {
    return { error: "El nombre es obligatorio." };
  }

  if (clean.length > MAX_NAME_LENGTH) {
    return { error: `El nombre no puede pasar de ${MAX_NAME_LENGTH} caracteres.` };
  }

  const taken = getAllCategories().some(
    (category) => category.id !== ignoreId && sameName(category.name, clean)
  );

  if (taken) {
    return { error: "Ya existe una categoría con ese nombre." };
  }

  return { name: clean };
}

// Devuelve { category } o { error }
export function addCategory(name) {
  const result = validateName(name);

  if (result.error) {
    return result;
  }

  const category = { id: generateId(), name: result.name };

  if (!saveCategories([...getCategories(), category])) {
    return { error: "No se pudo guardar la categoría." };
  }

  return { category };
}

// Para los formularios: si ya existe una con ese nombre la reutiliza, si no la crea.
// Devuelve { category } o { error }
export function findOrCreateCategory(name) {
  const clean = typeof name === "string" ? name.trim() : "";
  const existing = getAllCategories().find((category) => sameName(category.name, clean));

  return existing ? { category: existing } : addCategory(clean);
}

// Devuelve { category } o { error }
export function updateCategory(id, name) {
  const categories = getCategories();
  const index = categories.findIndex((category) => category.id === id);

  if (index === -1) {
    return { error: "La categoría no existe." };
  }

  const result = validateName(name, id);

  if (result.error) {
    return result;
  }

  categories[index] = { ...categories[index], name: result.name };

  if (!saveCategories(categories)) {
    return { error: "No se pudo guardar la categoría." };
  }

  return { category: categories[index] };
}

// Elimina la categoría y pasa sus tareas a "Sin categoría"
export function deleteCategory(id) {
  const categories = getCategories();
  const remaining = categories.filter((category) => category.id !== id);

  if (remaining.length === categories.length) {
    return false;
  }

  const tasks = getTasks().map((task) =>
    getTaskCategoryId(task) === id ? { ...task, categoryId: NONE_ID } : task
  );

  // Primero las tareas: si falla la segunda escritura no quedan tareas apuntando a nada
  return saveTasks(tasks) && saveCategories(remaining);
}

// Si el id no existe (por ejemplo, se borró), la tarea queda en "Sin categoría"
export function resolveCategoryId(id) {
  return getAllCategories().some((category) => category.id === id) ? id : NONE_ID;
}
