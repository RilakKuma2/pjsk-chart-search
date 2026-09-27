import { useEffect, useRef } from 'react';

const HISTORY_KEY = '__sekaiModal';
type Entry = { id: string; close: () => void; pathname: string; index: unknown };
const stack: Entry[] = [];
const retired = new Set<string>();
let sequence = 0;
let listening = false;
let pendingClose: { url: string; state: Record<string, unknown> } | null = null;
const registrations = new Set<() => void>();

function state() { return { ...(window.history.state || {}) }; }
function remove(entry: Entry) {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
}
function handleBack(event: PopStateEvent) {
    if (pendingClose) {
        event.stopImmediatePropagation();
        // Parent and child may unmount in the same render. Drain their stale
        // guards too, rather than leaving blank Back steps behind.
        if (retired.has(state()[HISTORY_KEY])) {
            retired.delete(state()[HISTORY_KEY]);
            window.history.back();
            return;
        }
        const closed = pendingClose;
        pendingClose = null;
        // Retain the underlying router index and parent modal marker, while
        // keeping query parameters already cleared by the close callback.
        window.history.replaceState({ ...closed.state, idx: state().idx, [HISTORY_KEY]: state()[HISTORY_KEY] }, '', closed.url);
        for (const register of registrations) register();
        registrations.clear();
        return;
    }
    const top = stack[stack.length - 1];
    if (!top || location.pathname !== top.pathname || state()[HISTORY_KEY] === top.id) return;
    event.stopImmediatePropagation();
    remove(top); // Unmount cleanup must not perform a second history.back().
    top.close();
}

/** One same-URL history entry per open modal, including directly linked modals. */
export default function useModalBackNavigation(onClose: () => void, enabled = true) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        if (!enabled) return;
        let disposed = false;
        let entry: Entry | undefined;
        const register = () => {
            if (disposed) return;
            if (pendingClose) { registrations.add(register); return; }
            if (!listening) {
                window.addEventListener('popstate', handleBack, true);
                listening = true;
            }
            const current = state();
            const parent = stack[stack.length - 1];
            // Updating a deep-link query with Router.replace drops custom state.
            // Restore the parent's guard before placing a child above it.
            if (parent && parent.pathname === location.pathname && parent.index === current.idx) {
                current[HISTORY_KEY] = parent.id;
                window.history.replaceState(current, '', location.href);
            }
            entry = { id: `modal-${Date.now()}-${++sequence}`, close: () => closeRef.current(), pathname: location.pathname, index: current.idx };
            window.history.pushState({ ...current, [HISTORY_KEY]: entry.id }, '', location.href);
            stack.push(entry);
        };
        // Avoid adding history for StrictMode's setup/cleanup rehearsal.
        queueMicrotask(register);
        return () => {
            disposed = true;
            registrations.delete(register);
            queueMicrotask(() => {
                if (!entry || !stack.includes(entry)) return;
                const wasTop = stack[stack.length - 1] === entry;
                remove(entry);
                retired.add(entry.id);
                if (retired.size > 256) retired.delete(retired.values().next().value!);
                const current = state();
                if (!wasTop || pendingClose || location.pathname !== entry.pathname) return;
                // Router replace() may have removed our marker when clearing a
                // deep-link parameter. Its index still identifies this entry.
                if (current[HISTORY_KEY] !== entry.id && current.idx !== entry.index) return;
                pendingClose = { url: location.href, state: current };
                retired.delete(entry.id);
                window.history.back();
            });
        };
    }, [enabled]);
}
