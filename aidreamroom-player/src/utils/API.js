import { POST, GET } from "./network"
import { localStorageKey } from '../constant/localStorageKey'

const setHeader = (token) => {
    if (token) {
        header['session_token'] = token;
        return;
    }
    delete header['session_token'];
}
const token = localStorage.getItem(localStorageKey.LOGIN_TOKEN);
const header = token ? { session_token: token } : {};

class api {
    /**
     * 用户相关API
     * @param {*} params 
     * @returns 
     */
    EMAIL_CHECK = (params) => {
        return POST('users/email/check', params);
    }
    EMAIL_REGISTER = (params) => {
        return POST('users/email/register', params);
    }
    EMAIL_LOGIN = (params) => {
        return POST('users/email/login', params);
    }
    EMIL_GET_CODE = (params) => {
        return GET('users/email/get/code', params)
    }
    EMAIL_EDIT_PASSWORD = (params) => {
        return POST('users/email/edit/password', params)
    }
    TOKEN_CHECK = (headers) => {
        return GET('users/token/check', null, headers)
    }
    ADD_LIKED = (params) => {
        return POST('users/add/liked', params, header)
    }
    REMOVE_LIKED = (params) => {
        return POST('users/remove/liked', params, header)
    }
    LIKED_LIST = () => {
        return GET('users/liked/list', null, header)
    }
    LIKED_LIST_DETAIL = () => {
        return GET('users/liked/list/detail', null, header)
    }
    UPLOAD = (params) => {
        return POST('upload', params);
    }
    QUERY_USERID = () => {
        return GET('users/query/userid', null, header)
    }

    USER_CHECK_HAS_INFO = () => {
        return GET('users/check/has/info', null, header);
    }
    USER_ROLE_EXISTS = () => {
        return GET('user-role/exists', null, header);
    }
    USER_ROLE_PROFILE = () => {
        return GET('user-role/profile', null, header);
    }
    USER_ROLE_CREATE = (params) => {
        return POST('user-role/create', params, header);
    }
    USER_ROLE_UPDATE = (params) => {
        return POST('user-role/update', params, header);
    }
    SKILL_LIST = () => {
        return GET('skills/list', null, header);
    }
    SKILL_DETAIL = (id) => {
        return GET(`skills/detail/${id}`, null, header);
    }
    SKILL_CREATE = (params) => {
        return POST('skills/create', params, header);
    }
    SKILL_UPDATE = (id, params) => {
        return POST(`skills/update/${id}`, params, header);
    }
    ITEM_LIST = () => {
        return GET('items/list', null, header);
    }
    ITEM_DETAIL = (id) => {
        return GET(`items/detail/${id}`, null, header);
    }
    ITEM_CREATE = (params) => {
        return POST('items/create', params, header);
    }
    ITEM_UPDATE = (id, params) => {
        return POST(`items/update/${id}`, params, header);
    }
    WAREHOUSE_PROFILE = () => {
        return GET('warehouse/profile', null, header);
    }
    WAREHOUSE_EXPAND = (params) => {
        return POST('warehouse/expand', params, header);
    }
    WAREHOUSE_STORE = (params) => {
        return POST('warehouse/store', params, header);
    }
    WAREHOUSE_DISCARD = (params) => {
        return POST('warehouse/discard', params, header);
    }
    QUERY_INFO = () => {
        return GET('users/query/info', null, header);
    }
    USERS_QUERY_MORE_DETAIL = () => {
        return GET('users/query/more/detail', null, header);
    }
    USERS_QUERY_USER_NAME_REPEAT = (params) => {
        return POST('users/query/user_name/repeat', params, header);
    }
    USERS_QUERY_FRIENDS = () => {
        return GET('users/query/friends', null, header);
    }
    USER_UPDATE_INFO = (params) => {
        return POST('users/update/info', params, header);
    }
    QUERY_INFO_BY_USERID = (params) => {
        return GET('users/query/info/by/userid', params, header);
    }
    USERS_QUERY_MORE_DETAIL_BY_USERID = (params) => {
        return GET('users/query/more/detail/by/userid', params, header);
    }
    USERS_ADD_FRIEND = (params) => {
        return POST('users/add/friend', params, header);
    }
    USERS_READ_ALL_NOTES = () => {
        return GET('users/read/all/notes', null, header);
    }
    USERS_UPDATE_FRIEND = (params) => {
        return POST('users/update/friend', params, header);
    }
    USERS_QUERY_USER_BYNAME = (params) => {
        return POST('users/query/user/byname', params, header);
    }
    USERS_QUERY_FULL_DETAIL_BY_USERID = (params) => {
        return GET('users/query/full/detail/by/userid', params, header);
    }
    USERS_GET_VERIFY_CODE = (params) => {
        return GET('users/get/verify/code', params, header)
    }
    /**
     * 世界观相关API
     * @param {*} params 
     * @returns 
     */
    OUTLOOK_LIST = () => {
        return GET('outlook/list', null, header);
    }
    OUTLOOK_LIST_ALL = () => {
        return GET('outlook/list/all', null, header);
    }
    OUTLOOK_CREATE = (params) => {
        return POST('outlook/create', params, header);
    }
    OUTLOOK_EDIT = (params) => {
        return POST('outlook/update', params, header);
    }
    OUTLOOK_LIST_ITEM = (params) => {
        return GET('outlook/list/item', params, header);
    }
    OUTLOOK_CREATE_ITEM = (params) => {
        console.log(header);
        return POST('outlook/create/item', params, header);
    }
    OUTLOOK_EDIT_ITEM = (params) => {
        return POST('outlook/edit/item', params, header);
    }
    OUTLOOK_DELETE_ITEM = (params) => {
        return POST('outlook/remove/item', params, header);
    }
    OUTLOOK_QUERY_ITEM = (params) => {
        return POST('outlook/query/item', params, header)
    }
    /**
      * 剧情相关API
      * @param {*} params 
      * @returns 
      */
    PLOT_LIST = () => {
        return GET('plot/list', null, header);
    }
    PLOT_LIST_ALL = () => {
        return GET('plot/list/all', null, header);
    }
    PLOT_CREATE = (params) => {
        return POST('plot/create', params, header);
    }
    PLOT_QUERY_ITEM = (params) => {
        return POST('plot/query/item', params, header)
    }
    PLOT_UPDATE = (params) => {
        return POST('plot/update', params, header);
    }

    PLOT_CREATE_BRANCH = (params) => {
        return POST('plot/create/branch', params, header);
    }
    PLOT_UPDATE_BRANCH = (params) => {
        return POST('plot/update/branch', params, header);
    }
    PLOT_QUERY_BRANCH = (params) => {
        return POST('plot/query/branch', params, header)
    }
    PLOT_QUERY_BRANCH_LIST = (params) => {
        return GET('plot/query/branch/list', params, header)
    }




    PLOT_LIST_ITEM = (params) => {
        return GET('plot/list/item', params, header);
    }
    PLOT_CREATE_ITEM = (params) => {
        console.log(header);
        return POST('plot/create/item', params, header);
    }
    PLOT_EDIT_ITEM = (params) => {
        return POST('plot/edit/item', params, header);
    }
    PLOT_EDIT_BRANCH = (params) => {
        return POST('plot/edit/branch', params, header);
    }
    PLOT_DELETE_ITEM = (params) => {
        return POST('plot/remove/item', params, header);
    }
    PLOT_DELETE_ITEM_SUB = (params) => {
        return POST('plot/remove/item/sub', params, header);
    }
    PLOT_EDIT_CONDITION = (params) => {
        return POST('plot/edit/condition', params, header);
    }

    PLOT_POSITION_RECORD = (params) => {
        return POST('plot/position/record', params, header)
    }
    PLOT_QUERY_POSITION = (params) => {
        return POST('plot/query/position', params, header)
    }
    PLOT_CREATE_KNOWLEDGE = (params) => {
        return POST('plot/create/knowledge', params, header)
    }
    PLOT_UPDATE_KNOWLEDGE = (params) => {
        return POST('plot/update/knowledge', params, header)
    }
    PLOT_QUERY_KNOWLEDGE = (params) => {
        return GET('plot/query/knowledge/list', params, header)
    }
    PLOT_DELETE_KNOWLEDGE = (params) => {
        return POST('plot/delete/knowledge', params, header);
    }
    /**
     * AI 生成
     * @returns 
     */
    AUTO_CHARACTER = () => {
        return GET('auto/character', null, header);
    }
    AUTO_CHARACTER_BACKGROUND = (params) => {
        return GET('auto/character/background', params, header);
    }
    /**
     * 角色相关内容
     * @returns 
     */
    CHARACTER_ADD = (params) => {
        return POST('character/add', params, header);
    }
    CHARACTER_LIST = (params) => {
        return GET('character/list', params, header);
    }
    CHARACTER_LIST_ALL = (params) => {
        return GET('character/list/all', params, header);
    }
    CHARACTER_EDIT = (params) => {
        return POST('character/edit', params, header)
    }
    CHARACTER_REMOVE = (params) => {
        return POST('character/remove', params, header)
    }

    PLAY_CREATE = (params) => {
        return POST('play/create', params, header)
    }
    PLAT_LATEST_GAME = () => {
        return GET('play/latest_game', null, header);
    }
    PLAT_QUERY_INFO = (params) => {
        return GET('play/query/info', params, header);
    }
    PLAT_QUERY_HISTORY = () => {
        return GET('play/query/history', null, header);
    }
    PLAY_QUERY_MODULE_LIST = () => {
        return GET('play/query/module/list', null, header);
    }
    PLAY_QUERY_TIMES_REMAIN = () => {
        return GET('play/query/times/remain', null, header);
    }
    /**
     * element api
     */
    ELEMENT_CREATE = (params) => {
        return POST('element/create', params, header)
    }
    ELEMENT_UPDATE = (params) => {
        return POST('element/update', params, header)
    }
    ELEMENT_LIST = () => {
        return GET('element/list', null, header);
    }
    ELEMENT_LIST_NOT_MINE = () => {
        return GET('element/list/not_mine', null, header);
    }
    ELEMENT_LIST_SHARED = () => {
        return GET('element/list/shared', null, header);
    }
    ELEMENT_DELETE = (params) => {
        return GET('element/delete', params, header);
    }
    ELEMENT_IMPORT_ITEMS = (params) => {
        return POST('element/import/items', params, header);
    }
    ELEMENT_QUERY_HIDDEN_ITEMS = (params) => {
        return GET('element/query/hidden/items', params, header);
    }
    ELEMENT_UPDATE_HIDE_ITEM = (params) => {
        return POST('element/update/hide/item', params, header)
    }
    ELEMENT_IMPORT_ITEMS = (params) => {
        return POST('element/import/items', params, header);
    }
    USER_CHECK_IN_REGISTERLIST = (params) => {
        return GET('users/check/in/registerlist', params, null);
    }
    USER_apply_reigset = (params) => {
        return POST('users/apply/reigset', params, null);
    }

    NUMERICAL_QUERY_ONLINE_TYPE = (params) => {
        return GET('numerical/query/online/type', null, null)
    }
}
const API = new api();
export { API, setHeader };
