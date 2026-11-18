import {generateId} from "../utils/id-generator.js";
import {getCategories, getTasks, saveCategories, saveTasks} from "./storage-service.js";

export const NONE_ID = "none";
export const IMPORTED_ID = "imported";

export const NONE_CATEGORY = {
  id: NONE_ID,
  name: "Sin categoría",
  system: true
};
export const IMPORTED_CATEGORY = {
    id: IMPORTED_ID,
    name: "Importadas",
    system: true
}

const MAX_NAME_LENGTH = 40;

function sameName(a,b){
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function getCategoryById(task){
    return task.categoryId ?? (task.imported ? IMPORTED_CATEGORY : NONE_ID);
}

//obtener cat
export function getUserCategories(){
    return getCategories();
}

//mostrar todas las categorias
export function getAllCategories(){
    return [NONE_CATEGORY, IMPORTED_CATEGORY, ...getCategories()];
}

function validateName(name, ignoredId = null){
    const clean = typeof name === "string" ? name.trim() : "";

    if(!clean){
        return {error: "El nombre es obligatorio"};
    }

    if(clean.length > MAX_NAME_LENGTH){
        return {error: `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres`};
    }

    const taken = getAllCategories().some(
        (category) => category.id !== ignoredId && sameName(category.name, clean)
    );

    if(taken){
        return {error: "Ya existe una categoría con ese nombre"};
    }

    return {name: clean};
}

//si ya hay una categoria con ese nombre, la devuelve, sino crea una nueva
export function findOrCreateCategory(name){
    const clean = typeof name === "string" ? name.trim() : "";
    const existing = getAllCategories().find((category) => sameName(category.name, clean));

    return existing ? {category: existing} : addCategory(clean);
}

//actualiza el nombre de una categoria, si no existe devuelve error
export function updateCategory(id, name){
    const categories = getCategories();
    const index = categories.findIndex((category) => category.id === id);

    if(index === -1){
        return {error: "No se encontró la categoría"};
    }

    const result = validateName(name, id);

    if(result.error){
        return result;
    }

    categories[index] = { ...categories[index], name: result.name };

    if (!saveCategories(categories)) {
        return {error: "No se pudo guardar la categoría"};
    }

    return { category: categories[index] };
}

export function deleteCategory(id){
    const categories = getCategories();
    const remaining = categories.filter((category) => category.id !== id);

    if(remaining.length === categories.length){
        return false;
    }

    const tasks = getTasks().map((task) => 
        getTaskCategoryId(task) === id ? { ...task, categoryId: NONE_ID } : task
    );

    return saveTasks(tasks) && saveCategories(remaining);
}