const requestGuards = new Map();

const DEFAULT_COOLDOWN_MS = 4000;

const createRequestId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const beginRateLimitedAction = (
    key,
    cooldownMs = DEFAULT_COOLDOWN_MS,
) => {
    const now = Date.now();
    const currentState = requestGuards.get(key) || {
        inFlight: false,
        cooldownUntil: 0,
        requestId: null,
    };

    if (currentState.inFlight) {
        return {
            allowed: false,
            reason: 'in_flight',
            remainingMs: Math.max(0, currentState.cooldownUntil - now),
        };
    }

    if (currentState.cooldownUntil > now) {
        return {
            allowed: false,
            reason: 'cooldown',
            remainingMs: currentState.cooldownUntil - now,
        };
    }

    const requestId = createRequestId();

    requestGuards.set(key, {
        inFlight: true,
        cooldownUntil: now + cooldownMs,
        requestId,
    });

    return {
        allowed: true,
        requestId,
        cooldownMs,
    };
};

export const finishRateLimitedAction = (key, requestId) => {
    const currentState = requestGuards.get(key);

    if (!currentState || currentState.requestId !== requestId) {
        return;
    }

    requestGuards.set(key, {
        ...currentState,
        inFlight: false,
    });
};

export const getRateLimitRemainingMs = (key) => {
    const currentState = requestGuards.get(key);

    if (!currentState) {
        return 0;
    }

    return Math.max(0, currentState.cooldownUntil - Date.now());
};

export const RATE_LIMIT_DEFAULTS = {
    CHECKOUT_SUBMIT: 4000,
    VNPAY_REDIRECT: 4000,
};
