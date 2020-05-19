import Vue from "vue";
import Vuex from "vuex";
import cookie from "js-cookie";
import { Notification } from "element-ui";
import Bridge from '@spaas/bridge';

import { getQueryString } from '@/utils/index';
import { IState } from './types';

import registerMicroAppsByMenu from '../auth';

import {
  login,
  getUserInfo,
  getOpenProducts,
  getUserPermission,
  findDrProduct,
} from "@/services/index";
import { getArtifactsMenu } from '@/services/asset-service-v2';

const cookieDomain = process.env.VUE_APP_COOKIE_DOMAIN;
const cookiePath = process.env.VUE_APP_COOKIE_PATH;
const cookieParams = {
  path: cookiePath,
  domain: cookieDomain,
};

Vue.use(Vuex);

// 最好提前在你的 store 中初始化好所有所需属性
// https://vuex.vuejs.org/zh-cn/mutations.html
let timer;

const state = (): IState => ({
  get token() {
    return cookie.get('token')
  },
  set token(value) {
    if (!!value) {
      cookie.set('token', value, cookieParams)
    } else {
      // 清空当前所有域名下的token
      // cookie.remove('token', cookieParams)
      cookie.set('token', '', cookieParams)
      cookie.remove('token')
      window.location.reload()
    }
    Bridge.store.set('token', value);
  },
  userInfo: null,

  menuList: null,

  appInfo: {
    "name": "测试中心", // 应用名称
    "description": "", // 应用描述
    "code": "", // code
    "logoUrl": "", // 图标URL
    "status": "", // 状态 0-启用 1-禁用
    "loginUrl": "", // 登录地址
  },

  collapse: false // 是否收缩侧边栏
});

//  mutation 必须同步执行
const mutations = {
  LOGIN(state, token) {
    state.token = token;
  },
  LOGOUT(state) {
    state.token = false;
  },
  SET_USER_INFO(state, userData) {
    state.user = userData;
    Bridge.store.set('userInfo', userData);
  },
  SET_MENU(state, menuList) {
    const {
      token,
      userInfo,
    } = state;
    state.menuList = menuList;
    if(menuList && menuList.length) {
      registerMicroAppsByMenu(menuList, {
        token,
        user: userInfo,
      });
    }
    Bridge.store.set('menuInfo', menuList);
  },
  update(state, payload) {
    Object.keys(payload).forEach((k) => {
      state[k] = payload[k];
    });
  },
};

// Action 提交的是 mutation，而不是直接变更状态
// Action 可以包含任意异步操作
const actions = {
  async LOGIN({ commit, dispatch }, params) {
    try {
      const res = await login(params);
      const token = res.payload.token;
      commit("LOGIN", token);

      await dispatch("GET_USER_INFO");
      await dispatch("GET_USER_PERMISSION");

    } catch (e) {
      return Promise.reject(e);
    }
  },
  async GET_USER_INFO({ state, commit }) {
    const artifactId = getQueryString('artifactId') || '1250843492740722690';
    let res = await getUserInfo(state.token);
    if(res && res.payload) {
      let userInfo = {
        ...res.payload,
        ...res.payload.params,
        appId: artifactId || 999
      };
      // 登陆做了调整，appid暂时写死
      commit("SET_USER_INFO", userInfo);
    } else {
      if (!timer) {
        Notification.error({
          title: "提示",
          message: "登陆超时，请重新登录！",
        });
        timer = setTimeout(() => {
          commit("LOGOUT");
        }, 2000);
      }
    }
  },
  async GET_USER_PERMISSION({ state, commit }) {
    // 2.1 判断当前的环境，重定向到对应的deepexi环境
    // 2.2 根据传过来的应用code来请求对应的菜单
    // 2.3 根据数据组装菜单
    const envType = getQueryString('envType') || 'dev';
    const artifactId = getQueryString('artifactId') || '1250843492740722690';
    if(!envType  || !artifactId) {
      Notification.error({
        title: "提示",
        message: "获取用户权限菜单失败",
      });
      return;
    }
    const dataList = await getArtifactsMenu({
      env: envType,
      artifactId
    })
    if(dataList && dataList.payload) {
      const childResult = (parentId, items) => {
        if(items && items.length) {
          return items.map(item => {
            const {url, id, name, menus} = item;
            return {
              id,
              tenantId: "admin",
              parentId,
              name,
              pathUrl: url,
              children: childResult(id, menus)
            }
          })
        }
        return []
      }
      const list = dataList.payload.map((item) => {
        const {entryJsFileUrl, id, name, menus} = item;
        return {
          id,
          tenantId: "admin",
          parentId: 0,
          name,
          pathUrl: entryJsFileUrl,
          children: childResult(id, menus)
        }
      })
      commit("SET_MENU", list);
    } else {
      Notification.error({
        title: "提示",
        message: "获取用户权限菜单失败",
      });
    }
    return;
  
    let res = await getOpenProducts();
    let saasProduct = res.payload.saas || [];
    let DR = findDrProduct(saasProduct);

    if (DR) {
      // TODO 根据传过来的ID来过滤开通的产品
      const permission = await getUserPermission(DR.id);
      commit("SET_MENU", permission.payload);
      commit("SET_USER_INFO", {
        ...state.user,
        appId: DR.id,
      });
    } else {
      Notification.error({
        title: "提示",
        message: "获取用户权限菜单失败",
      });
    }
  },
};

export default new Vuex.Store({
  state,
  mutations,
  actions,
});
