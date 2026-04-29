const URLS = {
    'live': ' http://aidr.infinityplanet.world:8300'
}
export const API_BASE_URL = 'http://localhost:8380/';
const baseUrl = API_BASE_URL;
// const baseUrl = 'http://aidr.infinityplanet.world:8380/';

export function resolveLegacyWsUrl(port = 3300) {
    const fallbackOrigin =
        typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'http://localhost:8380';

    try {
        const base = new URL(baseUrl, fallbackOrigin);
        const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${base.hostname}:${port}/`;
    } catch {
        return `ws://localhost:${port}/`;
    }
}

export async function GET(url, params = null, headers = {}) {
    let paramsString = '';
    if (params) {
        for (const key of Object.keys(params)) {
            const value = params[key];
            paramsString += `${key}=${value}&`
        }
    }
    const result = await fetch(`${baseUrl}${url}${paramsString ? '?' + paramsString : paramsString}`, {
        method: 'GET',
        headers: {
            ...defaultHeader,
            ...headers
        }
    })
    return await result.json();
}
export async function POST(url, params, headers = {}) {
    const result = await fetch(`${baseUrl}${url}`, {
        method: 'POST',
        body: JSON.stringify(params),
        headers: {
            ...defaultHeader,
            ...headers
        }
    })
    return await result.json();
}
export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === name + "=") {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const defaultHeader = {
    "Content-Type": "application/json"
}
