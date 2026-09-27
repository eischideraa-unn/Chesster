class TestResizeObserver implements ResizeObserver {
	private readonly callback: ResizeObserverCallback;

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}

	observe(target: Element) {
		Object.defineProperties(target, {
			clientWidth: { configurable: true, value: 600 },
			clientHeight: { configurable: true, value: 600 },
		});
		this.callback([], this);
	}

	unobserve() {}
	disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver;
