/**
 * ## Events
 * ------------------
 */


export type EventCallback = (...args: any[]) => void;

class EventEmitter<T extends EventCallback> {
    /**
     * A "no op" emitter for when there are no registered listeners
     */
    public static noopEmitter = () => {
        return;
    };

    private callbacks: T[] = [];

    /**
     * Adds the listener to the end of the listener list.
     *
     * If the listener is already in the list, it is first removed.
     */
    public add(callback: T) {
        this.remove(callback);
        this.callbacks.push(callback);
    }

    /**
     * Removes the listener, if found. Returns whether or not the `EventEmitter`
     * has any remaining listeners.
     */
    public remove(callback?: T) {
        if (callback != null) {
            const i = this.callbacks.indexOf(callback);
            if (i >= 0) {
                this.callbacks.splice(i, 1);
            }
        }
        return this.isEmpty();
    }

    public isEmpty() {
        return this.callbacks.length === 0;
    }

    /**
     * Calls all listeners with the specified arguments
     */
    public emit = (...args: any[]) => {
        for (const callback of this.callbacks) {
            callback.apply(null, args);
        }
    };
}

type EmitterMap<T> = Partial<Record<keyof T, EventEmitter<EventCallback>>>;

export interface EventRegistrar<T> {
    on: <E extends keyof T, C extends T[E] & EventCallback>(eventName: E, callback: C) => Events<T>;
    off: <E extends keyof T, C extends T[E] & EventCallback>(eventName: E, callback?: C) => Events<T>;
}

/**
 * A typed event object that typechecks event callbacks and emitter invocations.
 *
 * When you create a new events object, you must specify a template type `T`
 * whose keys are `eventName`s and whose values are the callback signature. This
 * will enforce all events are listened to and emitted with the proper
 * function signature.
 *
 * For example:
 * ```typescript
 * interface IMyEvents {
 *   myevent: (value: string) => void;
 * }
 *
 * const events = new Events<IMyEvents>();
 *
 * // this COMPILES
 * events.on("myevent", (value: string) => console.log(value));
 *
 * // this ERRORS because the callback should take a string argument
 * events.on("myevent", (value: number) => console.log(value));
 *
 * // this ERRORS because the event name is not on `IMyEvents`
 * events.on("invalidevent", () => {});
 *
 * // this COMPILES
 * events.emitter("myevent")("hello");
 *
 * // this ERRORS because the callback should take a string argument
 * events.emitter("myevent")(3.14);
 *
 * // this ERRORS because the event name is not on `IMyEvents`
 * events.emitter("invalidevent")("hello");
 *
 * ```
 */
export class Events<T> implements EventRegistrar<T> {
    private emitters: EmitterMap<T> = {};

    /**
     * Attaches a listener to the event. The typechecks enforce that `eventName`
     * is a key of the template type `T` and that the callback is a function
     * that matches the signature of the `eventName`'s value.
     */
    public on = <E extends keyof T, C extends T[E] & EventCallback>(eventName: E, callback: C) => {
        if (this.emitters[eventName] == null) {
            this.emitters[eventName] = new EventEmitter<C>();
        }
        this.emitters[eventName].add(callback);
        return this;
    };

    /**
     * If `callback` is specified, it will be removed from the listener list for
     * the specified `eventName`. If no `callback` is specified, all listeners
     * for `eventType` will be removed.
     */
    public off = <E extends keyof T, C extends T[E] & EventCallback>(eventName: E, callback?: C) => {
        const emitter = this.emitters[eventName];
        if (emitter != null) {
            if (emitter.remove(callback)) {
                // NOTE: we don't actually want to delete the emitter because we rely on emitter references being long lived
                // delete this.emitters[eventName];
            }
        }
        return this;
    };

    /**
     * Clears all listeners for all events
     */
    public clear() {
        this.emitters = {};
        return this;
    }

    /**
     * Returns a function whose type matches the `eventName`'s interface method.
     * If no listeners are registered, a type-safe "no op" function is returned.
     *
     * Emitters are created when listeners are registered so it is not expensive
     * to invoke this method many times.
     *
     * WARNING: Do not store emitter instances because the emitters may be
     * created/destroyed as listeners are added/removed.
     */
    public emitter<E extends keyof T, C extends T[E] & EventCallback>(eventName: E): C {
        if (this.emitters[eventName] == null) {
            this.emitters[eventName] = new EventEmitter<C>();
        }
        const emitter = this.emitters[eventName];

        // Here we do some strong type coercion. This could be avoided with
        // restrictions on the `T` template type, but all my attempts to do so
        // resulted in compilation exceptions (not just errors). The hidden
        // assumption here is that type `T` has props whose values are all
        // functions. This cannot be expressed in typescript without using an
        // index signature (which breaks the keyof typecheck), so we just cast.
        const func: any = emitter ? emitter.emit : EventEmitter.noopEmitter;
        return func as C;
    }
}
