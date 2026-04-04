/** Minimal Chrome extension API types for Astro browser integration */
declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(
        keys: string[],
        callback: (result: Record<string, string>) => void,
      ): void;
    }
    const local: StorageArea | undefined;
  }
}
