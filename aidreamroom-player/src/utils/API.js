import { GET, POST } from './network';
import { localStorageKey } from '../constant/localStorageKey';

const token = localStorage.getItem(localStorageKey.LOGIN_TOKEN);
const header = token ? { session_token: token } : {};

const setHeader = (nextToken) => {
  if (nextToken) {
    header.session_token = nextToken;
    return;
  }

  delete header.session_token;
};

class Api {
  EMAIL_CHECK = (params) => POST('users/email/check', params);

  EMAIL_REGISTER = (params) => POST('users/email/register', params);

  EMAIL_LOGIN = (params) => POST('users/email/login', params);

  EMIL_GET_CODE = (params) => GET('users/email/get/code', params);

  EMAIL_EDIT_PASSWORD = (params) => POST('users/email/edit/password', params);

  TOKEN_CHECK = (headers) => GET('users/token/check', null, headers);

  ADD_LIKED = (params) => POST('users/add/liked', params, header);

  REMOVE_LIKED = (params) => POST('users/remove/liked', params, header);

  LIKED_LIST = () => GET('users/liked/list', null, header);

  UPLOAD = (params) => POST('upload', params);

  QUERY_USERID = () => GET('users/query/userid', null, header);

  USER_CHECK_HAS_INFO = () => GET('users/check/has/info', null, header);

  USER_ROLE_EXISTS = () => GET('user-role/exists', null, header);

  USER_ROLE_PROFILE = () => GET('user-role/profile', null, header);

  USER_ROLE_CREATE = (params) => POST('user-role/create', params, header);

  USER_ROLE_UPDATE = (params) => POST('user-role/update', params, header);

  SKILL_LIST = () => GET('skills/list', null, header);

  SKILL_DETAIL = (id) => GET(`skills/detail/${id}`, null, header);

  SKILL_CREATE = (params) => POST('skills/create', params, header);

  SKILL_UPDATE = (id, params) => POST(`skills/update/${id}`, params, header);

  ITEM_LIST = () => GET('items/list', null, header);

  ITEM_DETAIL = (id) => GET(`items/detail/${id}`, null, header);

  ITEM_CREATE = (params) => POST('items/create', params, header);

  ITEM_UPDATE = (id, params) => POST(`items/update/${id}`, params, header);

  WAREHOUSE_PROFILE = () => GET('warehouse/profile', null, header);

  WAREHOUSE_EXPAND = (params) => POST('warehouse/expand', params, header);

  WAREHOUSE_STORE = (params) => POST('warehouse/store', params, header);

  WAREHOUSE_DISCARD = (params) => POST('warehouse/discard', params, header);

  QUERY_INFO = () => GET('users/query/info', null, header);

  USERS_QUERY_MORE_DETAIL = () => GET('users/query/more/detail', null, header);

  USERS_QUERY_USER_NAME_REPEAT = (params) =>
    POST('users/query/user_name/repeat', params, header);

  USERS_QUERY_FRIENDS = () => GET('users/query/friends', null, header);

  USER_UPDATE_INFO = (params) => POST('users/update/info', params, header);

  QUERY_INFO_BY_USERID = (params) => GET('users/query/info/by/userid', params, header);

  USERS_QUERY_MORE_DETAIL_BY_USERID = (params) =>
    GET('users/query/more/detail/by/userid', params, header);

  USERS_ADD_FRIEND = (params) => POST('users/add/friend', params, header);

  USERS_READ_ALL_NOTES = () => GET('users/read/all/notes', null, header);

  USERS_UPDATE_FRIEND = (params) => POST('users/update/friend', params, header);

  USERS_QUERY_USER_BYNAME = (params) => POST('users/query/user/byname', params, header);

  USERS_QUERY_FULL_DETAIL_BY_USERID = (params) =>
    GET('users/query/full/detail/by/userid', params, header);

  USERS_GET_VERIFY_CODE = (params) => GET('users/get/verify/code', params, header);

  SCRIPT_QUERY = (params) => GET('script/query', params, header);

  SCRIPT_RANDOM = () => GET('script/random', null, header);

  PLAY_CREATE = (params) => POST('play/create', params, header);

  PLAT_LATEST_GAME = () => GET('play/latest_game', null, header);

  PLAT_QUERY_INFO = (params) => GET('play/query/info', params, header);

  PLAT_QUERY_HISTORY = () => GET('play/query/history', null, header);

  PLAY_QUERY_MODULE_LIST = () => GET('play/query/module/list', null, header);

  PLAY_QUERY_TIMES_REMAIN = () => GET('play/query/times/remain', null, header);

  USER_CHECK_IN_REGISTERLIST = (params) =>
    GET('users/check/in/registerlist', params, null);

  USER_apply_reigset = (params) => POST('users/apply/reigset', params, null);

  NUMERICAL_QUERY_ONLINE_TYPE = () =>
    GET('numerical/query/online/type', null, null);
}

const API = new Api();

export { API, setHeader };
