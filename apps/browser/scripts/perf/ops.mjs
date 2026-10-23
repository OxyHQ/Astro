const TARGETS = {
  String: ["includes", "startsWith", "endsWith", "indexOf", "lastIndexOf", "toLowerCase", "toUpperCase", "normalize", "split", "slice", "substring", "charCodeAt", "replace", "replaceAll", "match", "trim", "localeCompare", "concat"],
  RegExp: ["exec", "test"],
  Array: ["map", "filter", "push", "splice", "slice", "concat", "sort", "indexOf", "includes", "find", "findIndex", "some", "every", "reduce", "forEach", "flatMap", "join", "pop", "shift", "unshift"],
  Map: ["get", "set", "has", "delete"],
  Set: ["add", "has", "delete"],
  Object: ["keys", "values", "entries", "assign", "fromEntries", "freeze"],
  JSON: ["stringify", "parse"],
  Date: ["now"],
  Math: ["log2", "max", "min", "floor"],
};

const holders = {
  String: String.prototype,
  RegExp: RegExp.prototype,
  Array: Array.prototype,
  Map: Map.prototype,
  Set: Set.prototype,
  Object,
  JSON,
  Date,
  Math,
};

export function countOps(fn) {
  const by = Object.create(null);
  const restore = [];
  for (const [owner, names] of Object.entries(TARGETS)) {
    const holder = holders[owner];
    for (const name of names) {
      const original = holder[name];
      if (typeof original !== "function") continue;
      const key = `${owner}.${name}`;
      by[key] = 0;
      holder[name] = function (...args) {
        by[key]++;
        return original.apply(this, args);
      };
      restore.push(() => (holder[name] = original));
    }
  }
  try {
    fn();
  } finally {
    for (const undo of restore) undo();
  }
  let total = 0;
  for (const k of Object.keys(by)) {
    if (!by[k]) delete by[k];
    else total += by[k];
  }
  return { total, by };
}
