let counter = 0;

/**
 * Generates a simple incrementing unique ID.
 * Much faster than uuidv4 for high-frequency game objects.
 */
export function nextId(): string {
  return (counter++).toString();
}
