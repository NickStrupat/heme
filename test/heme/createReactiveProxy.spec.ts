import { createReactiveProxy } from "../../src/heme/createReactiveProxy";
import { it, describe } from "node:test";
import { strict as assert } from "node:assert";

describe(createReactiveProxy.name, () => {
	it("should create a proxy that mirrors basic property accesses", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		const obj = {a: 1, b: 2};
		const proxy = createReactiveProxy(obj, handler);

		assert.strictEqual(obj.a, 1);
		assert.strictEqual(proxy.a, 1);

		assert.strictEqual(obj.b, 2);
		assert.strictEqual(proxy.b, 2);

		proxy.a = 3;
		assert.strictEqual(obj.a, 3);
		assert.strictEqual(proxy.a, 3);
	});

	it("should update the original object when the proxy is modified", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		const obj = {a: 1, b: 2};
		const proxy = createReactiveProxy(obj, handler);

		proxy.a = 3;
		assert.strictEqual(obj.a, 3);
		assert.strictEqual(proxy.a, 3);
		assert.deepStrictEqual(events, [{obj, propKey: "a", detail: {oldValue: 1, newValue: 3}}]);
	});

	it("should update the proxy when the original object is modified, but without reactivity", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		const obj = {a: 1, b: 2};
		const proxy = createReactiveProxy(obj, handler);

		obj.b = 4;
		assert.strictEqual(proxy.b, 4);
		assert.strictEqual(events.length, 0);
	});

	it("should delete properties from the original object", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		interface Obj { a?: number; b: number; }
		const obj: Obj = {a: 1, b: 2};
		const proxy = createReactiveProxy(obj, handler);

		assert.strictEqual("a" in obj, true);
		assert.strictEqual("a" in proxy, true);
		delete proxy.a;
		assert.strictEqual("a" in obj, false);
		assert.strictEqual("a" in proxy, false);
		assert.deepStrictEqual(events, [{obj, propKey: "a", detail: {oldValue: 1}}]);
	});

	it("should delete properties from the proxy, but without reactivity", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		interface Obj { a?: number; b: number; }
		const obj: Obj = {a: 1, b: 2};
		const proxy = createReactiveProxy(obj, handler);

		assert.strictEqual("a" in obj, true);
		assert.strictEqual("a" in proxy, true);
		delete obj.a;
		assert.strictEqual("a" in obj, false);
		assert.strictEqual("a" in proxy, false);
		assert.deepStrictEqual(events, []);
	});

	it("should handle nested objects", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		const obj = {a: 1, b: {c: 2}};
		const proxy = createReactiveProxy(obj, handler);

		assert.strictEqual(proxy.b.c, 2);
		proxy.b.c = 3;
		assert.strictEqual(obj.b.c, 3);
		assert.strictEqual(proxy.b.c, 3);
	});

	it("should emit an event with the new value detail when a new property is set", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		interface Obj { a?: number; }
		const obj: Obj = {};
		const proxy = createReactiveProxy(obj, handler);

		proxy.a = 1;
		assert.deepStrictEqual(events, [{obj, propKey: "a", detail: {newValue: 1}}]);
	});

	it("should emit an event with the old and new value details when an existing property is set to a different value", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		const obj = {a: 1};
		const proxy = createReactiveProxy(obj, handler);

		proxy.a = 2;
		assert.deepStrictEqual(events, [{obj: obj, propKey: "a", detail: {oldValue: 1, newValue: 2}}]);
	});

	it("should not emit an event when setting an existing property to the same value", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		const proxy = createReactiveProxy({a: 1}, handler);

		proxy.a = 1; // Setting to the same value
		assert.deepStrictEqual(events, []); // No event should be emitted
	});

	it("should emit an event with the old value detail when a property is deleted", () => {
		const events: { obj: object, propKey: any, detail: {} }[] = [];
		const handler = (obj: object, propKey: any, detail: any) => events.push({obj, propKey, detail});

		interface Obj { a?: number; }
		const obj: Obj = {a: 1};
		const proxy = createReactiveProxy(obj, handler);

		delete proxy.a;
		assert.deepStrictEqual(events, [{obj, propKey: "a", detail: {oldValue: 1}}]);
	});

	it("should track properties that functions depend on", () => {
		const events: { obj: object, propKey: any, detail?: {} }[] = [];
		const handler = (obj: object, propKey: any, detail?: any) => events.push(
			detail === undefined
				? { obj, propKey }
				: { obj, propKey, detail }
		);

		const obj = {
			a: 1,
			b: 2,
			sum() { return this.a + this.b }
		};
		const proxy = createReactiveProxy(obj, handler);
		proxy.sum();
		proxy.a = 3;
		// const a = (proxy as any)[propFuncDepsSymbol];
		assert.deepEqual(events, [
			{obj, propKey: "a", detail: {oldValue: 1, newValue: 3}},
			{obj, propKey: "sum"}
		]);
	});
});