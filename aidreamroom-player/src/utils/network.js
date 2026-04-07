const URLS = {
    'live': ' http://aidr.infinityplanet.world:8300'
}
const baseUrl = 'http://localhost:8380/';
// const baseUrl = 'http://aidr.infinityplanet.world:8380/';

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
