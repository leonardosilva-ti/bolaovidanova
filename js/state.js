import { storage } from "./utils.js";

const USER_KEY = "bolao.userToken";
const ADMIN_KEY = "bolao.adminToken";

/** Estado global da aplicação (em memória + token na sessionStorage para sobreviver ao F5). */
export const state = {
  userToken: storage.get(USER_KEY),
  adminToken: storage.get(ADMIN_KEY),
  user: null,
  dashboard: null,
  participantes: [],
  ultimoRateio: null,
  register: {},
};

export function setUserToken(token) {
  state.userToken = token || null;
  token ? storage.set(USER_KEY, token) : storage.remove(USER_KEY);
}

export function setAdminToken(token) {
  state.adminToken = token || null;
  token ? storage.set(ADMIN_KEY, token) : storage.remove(ADMIN_KEY);
}

export function clearSession() {
  setUserToken(null);
  setAdminToken(null);
  state.user = null;
  state.dashboard = null;
  state.participantes = [];
  state.ultimoRateio = null;
  state.register = {};
}
