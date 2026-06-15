export function getApiBaseUrl() {
    const configuredUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    if (typeof window === 'undefined') return configuredUrl;

    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalHost) return configuredUrl;

    try {
        const url = new URL(configuredUrl);
        const configuredHost = url.hostname;
        const pointsToLocalhost = configuredHost === 'localhost' || configuredHost === '127.0.0.1';
        if (pointsToLocalhost) {
            return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
        }
    } catch {
        return configuredUrl;
    }

    return configuredUrl;
}
