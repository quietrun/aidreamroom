export let userId = '';
const version = '0.9.3'
export let firstLogin = queryFirstLogin();
export function setUserId(id) {
    console.log('setUserId', id);
    userId = id;
}
function queryFirstLogin() {
    let data = localStorage.getItem('aidreamroom-firstLogin');
    if (data != version) {
        localStorage.setItem('aidreamroom-firstLogin', version)
        return true;
    } else {
        return false;
    }
}