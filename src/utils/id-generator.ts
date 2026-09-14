import { v4 as uuidv4 } from 'uuid';

/**
 * Generate standard fields for entity creation
 * @returns Object with id and updatedAt fields
 */
export function generateStandardFields() {
  return {
    id: uuidv4(),
    updatedAt: new Date(),
  };
}

/**
 * Add standard fields to an entity data object
 * @param data Entity data object
 * @returns Data with id and updatedAt fields added
 */
export function addStandardFields<T extends Record<string, any>>(data: T): T & { id: string; updatedAt: Date } {
  return {
    ...data,
    ...generateStandardFields(),
  };
}
