import '@testing-library/jest-dom';

// Polyfill scrollIntoView if missing
if (typeof window !== 'undefined') {
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}

// Polyfill BroadcastChannel if not available in jsdom
if (typeof window !== 'undefined' && !window.BroadcastChannel) {
  class MockBroadcastChannel {
    name: string;
    onmessage: ((event: any) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(data: any) {
      // noop
    }
    close() {
      // noop
    }
  }
  window.BroadcastChannel = MockBroadcastChannel as any;
}
