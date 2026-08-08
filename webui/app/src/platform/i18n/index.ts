import {en, type MessageId} from './en.ts';

export type {MessageId};

/**
 * A message, by id.
 *
 * Placeholders are `{name}` and are substituted from `params`. An unmatched
 * placeholder is left as written rather than blanked, so a missing argument
 * shows up in the UI as `{controller}` instead of a sentence with a hole in it.
 */
export function t(id: MessageId, params?: Readonly<Record<string, string>>): string {
  const message: string = en[id];
  if (!params) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => params[name] ?? placeholder);
}
