export { createReactiveProxy, propFuncDepsSymbol };

const isProxySymbol: unique symbol = Symbol();
const isProxy = (obj: any): boolean => Reflect.has(obj, isProxySymbol);
const isProxyable = (obj: any): obj is object => obj !== null && typeof obj === 'object';

type EventDetail = { oldValue: any } | { oldValue: any, newValue: any } | { newValue: any };
type EventHandler = (obj: object, propKey: any, detail?: EventDetail) => void;

const propFuncDepsSymbol: unique symbol = Symbol();

function createReactiveProxy<T extends object>(model: T, handler: EventHandler): T {
	if (isProxy(model))
		throw new Error("Object is already proxied.");
	const propProxies = new Map<string | symbol, object>();
	const propFuncDependencies = new Map<string | symbol, Set<string | symbol>>();
	let activeFuncProp: string | symbol | null = null;
	return new Proxy(model, {
		has(target, p) {
			if (p === isProxySymbol)
				return true;
			return Reflect.has(target, p);
		},
		get(target, p, receiver) {
			if (p === propFuncDepsSymbol)
				return propFuncDependencies;
			const value = Reflect.get(target, p, receiver);
			if (typeof value === 'function' && value.length === 0) {
				return new Proxy(value, {
					apply(applyTarget, thisArg, args) {
						activeFuncProp = p;
						try { return Reflect.apply(applyTarget, thisArg, args); }
						finally { activeFuncProp = null; }
					}
				});
			}
			if (activeFuncProp !== null)
				getOrAdd(propFuncDependencies, p, () => new Set<string | symbol>()).add(activeFuncProp);
			return isProxyable(value)
				? getOrAdd(propProxies, p, () => createReactiveProxy(value, handler))
				: value;
		},
		set(target, p, newValue, receiver) {
			const existed = Reflect.has(target, p);
			const oldValue = existed ? Reflect.get(target, p, receiver) : undefined;
			if (!Reflect.set(target, p, newValue, receiver))
				return false;
			if (isProxyable(newValue))
				propProxies.set(p, newValue = createReactiveProxy(newValue, handler));
			if (!existed)
				handler(target, p, { newValue });
			else if (oldValue !== newValue) {
				handler(target, p, { oldValue, newValue });
				propFuncDependencies.get(p)?.forEach(prop => handler(target, prop));
			}
			return true;
		},
		deleteProperty(target, p) {
			const exists = Reflect.has(target, p);
			const oldValue = exists ? Reflect.get(target, p) : undefined;
			if (!Reflect.deleteProperty(target, p))
				return false;
			propProxies.delete(p);
			handler(target, p, { oldValue });
			return true;
		}
	});
}

function getOrAdd<K, V>(
	map: Map<K, V> | (K extends object ? WeakMap<K, V> : never),
	key: K,
	valueFactory: () => V
): V {
	let value = map.get(key);
	if (value === undefined)
		map.set(key, value = valueFactory());
	return value;
}

type ReactiveProxy<T extends object> = T & {
	[isProxySymbol]: any
	propSetByFuncs: Map<string | symbol, Set<string | symbol>>;
	propsGotByFuncs: Map<string | symbol, Set<string | symbol>>;
};
