const RawEventEmitter = {
  addListener: (_eventName: string, _listener: (...args: unknown[]) => unknown) => ({ remove() {} }),
  emit: (_eventName: string, ..._args: unknown[]) => {},
};

export default RawEventEmitter;
