const parseVersion = (version: string) => {
  const [core = "", pre] = version.split("-", 2);
  const preParts = pre?.split(".") ?? [];
  return { core: core.split(".").map(Number), pre: preParts };
};

const comparePre = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return b.length - a.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const [x, y] = [a[i], b[i]];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const [nx, ny] = [Number(x), Number(y)];
    const d = Number.isInteger(nx) && Number.isInteger(ny) ? nx - ny : x.localeCompare(y);
    if (d) return Math.sign(d);
  }
  return 0;
};

export const compareVersions = (a: string, b: string) => {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < Math.max(x.core.length, y.core.length); i++) {
    const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return comparePre(x.pre, y.pre);
};

export const newestFirst = (a: string, b: string) => compareVersions(b, a);

