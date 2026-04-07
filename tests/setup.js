/**
 * Test setup — Chrome API mocks for extension testing
 */

export function createChromeMock() {
  const storage = {};
  return {
    tabs: {
      query: async () => [{ id: 1, url: 'https://www.linkedin.com/feed/' }],
      onRemoved: { addListener: () => {} },
    },
    runtime: {
      sendMessage: () => {},
      onMessage: { addListener: () => {} },
      lastError: null,
    },
    action: {
      setBadgeText: () => {},
      setBadgeBackgroundColor: () => {},
      setTitle: () => {},
    },
    storage: {
      local: {
        get: async (keys) => {
          if (typeof keys === 'string') keys = [keys];
          const result = {};
          for (const k of keys) {
            if (storage[k] !== undefined) result[k] = storage[k];
          }
          return result;
        },
        set: async (obj) => Object.assign(storage, obj),
        _data: storage,
      },
    },
    scripting: {
      executeScript: async ({ func }) => {
        const result = func();
        return [{ result }];
      },
    },
    declarativeNetRequest: {
      onRuleMatchedDebug: null,
    },
    webNavigation: {
      onCommitted: { addListener: () => {} },
    },
  };
}

export function createDOMMock() {
  const attrs = {};
  const elements = {};

  return {
    documentElement: {
      getAttribute: (name) => attrs[name] || null,
      setAttribute: (name, value) => {
        attrs[name] = value;
      },
    },
    getElementById: (id) => {
      if (!elements[id]) {
        elements[id] = {
          textContent: '',
          innerHTML: '',
          style: { display: '' },
          value: '',
          disabled: false,
          startsWith: () => false,
          addEventListener: () => {},
          click: () => {},
        };
      }
      return elements[id];
    },
    addEventListener: (event, fn) => fn(),
    _attrs: attrs,
    _elements: elements,
  };
}
