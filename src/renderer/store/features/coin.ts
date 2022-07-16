import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import PromiseWorker from 'promise-worker';
import { batch } from 'react-redux';
import { AsyncThunkConfig } from '@/store';
import { sortWorker } from '@/workers';
import * as Utils from '@/utils';
import * as Enums from '@/utils/enums';

export interface CoinState {
  coins: (Coin.ResponseItem & Coin.ExtraRow)[];
  coinsLoading: boolean;
  config: {
    coinConfig: Coin.SettingItem[];
    codeMap: Coin.CodeMap;
  };
  remoteCoins: Coin.RemoteCoin[];
  remoteCoinsMap: Record<string, Coin.RemoteCoin>;
  remoteCoinsLoading: boolean;
}

const initialState: CoinState = {
  coins: [],
  coinsLoading: false,
  config: { coinConfig: [], codeMap: {} },
  remoteCoins: [],
  remoteCoinsMap: {},
  remoteCoinsLoading: false,
};

const coinSlice = createSlice({
  name: 'coin',
  initialState,
  reducers: {
    setCoinsLoadingAction(state, action: PayloadAction<boolean>) {
      state.coinsLoading = action.payload;
    },
    syncCoinsAction(state, action) {
      state.coins = action.payload;
    },
    syncCoinsConfigAction(state, action: PayloadAction<{ coinConfig: Coin.SettingItem[]; codeMap: Coin.CodeMap }>) {
      state.config = action.payload;
    },
    syncRemoteCoinsMapAction(state, { payload }: PayloadAction<Record<string, Coin.RemoteCoin>>) {
      state.remoteCoins = Object.values(payload);
      state.remoteCoinsMap = payload;
    },
    setRemoteCoinsLoadingAction(state, action: PayloadAction<boolean>) {
      state.remoteCoinsLoading = action.payload;
    },
    toggleCoinCollapseAction(state, { payload }: PayloadAction<Coin.ResponseItem & Coin.ExtraRow>) {
      const { coins } = state;
      coins.forEach((item) => {
        if (item.code === payload.code) {
          item.collapse = !payload.collapse;
        }
      });
    },
    toggleAllCoinsCollapseAction(state) {
      const { coins } = state;
      const expandAll = coins.every((item) => item.collapse);
      coins.forEach((item) => {
        item.collapse = !expandAll;
      });
    },
  },
});

export const {
  setCoinsLoadingAction,
  syncCoinsAction,
  syncCoinsConfigAction,
  syncRemoteCoinsMapAction,
  setRemoteCoinsLoadingAction,
  toggleCoinCollapseAction,
  toggleAllCoinsCollapseAction,
} = coinSlice.actions;

export const addCoinAction = createAsyncThunk<void, Coin.SettingItem, AsyncThunkConfig>(
  'coin/addCoinAction',
  async (coin, { dispatch, getState }) => {
    try {
      const {
        coin: {
          config: { coinConfig },
        },
      } = getState();
      const exist = coinConfig.find((item) => coin.code === item.code);
      if (!exist) {
        dispatch(setCoinConfigAction(coinConfig.concat(coin)));
      }
    } catch (error) {}
  }
);

export const deleteCoinAction = createAsyncThunk<void, string, AsyncThunkConfig>(
  'coin/deleteCoinAction',
  async (code, { dispatch, getState }) => {
    try {
      const {
        coin: {
          config: { coinConfig },
        },
      } = getState();
      const cloneCoinConfig = coinConfig.slice();

      cloneCoinConfig.forEach((item, index) => {
        if (code === item.code) {
          cloneCoinConfig.splice(index, 1);
          dispatch(setCoinConfigAction(cloneCoinConfig));
        }
      });
    } catch (error) {}
  }
);

export const setCoinConfigAction = createAsyncThunk<void, Coin.SettingItem[], AsyncThunkConfig>(
  'coin/setCoinConfigAction',
  async (coinConfig, { dispatch, getState }) => {
    try {
      const {
        coin: { coins },
      } = getState();

      const codeMap = Utils.GetCodeMap(coinConfig, 'code');

      batch(() => {
        dispatch(syncCoinsConfigAction({ coinConfig, codeMap }));
        dispatch(syncCoinsStateAction(coins));
      });
    } catch (error) {}
  }
);

export const sortCoinsAction = createAsyncThunk<void, void, AsyncThunkConfig>('coin/sortCoinsAction', async (_, { dispatch, getState }) => {
  try {
    const {
      coin: {
        coins,
        config: { codeMap },
      },
      sort: {
        sortMode: {
          coinSortMode: { order, type },
        },
      },
    } = getState();

    const sortList = await new PromiseWorker(sortWorker).postMessage({
      module: Enums.TabKeyType.Coin,
      codeMap,
      list: coins,
      sortType: type,
      orderType: order,
    });

    dispatch(syncCoinsStateAction(sortList));
  } catch (error) {}
});

export const sortCoinsCachedAction = createAsyncThunk<void, Coin.ResponseItem[], AsyncThunkConfig>(
  'coin/sortCoinsCachedAction',
  async (responseCoins, { dispatch, getState }) => {
    try {
      const {
        coin: {
          coins,
          config: { coinConfig },
        },
      } = getState();

      const coinsWithChached = Utils.MergeStateWithResponse(coinConfig, 'code', 'code', coins, responseCoins);

      batch(() => {
        dispatch(syncCoinsStateAction(coinsWithChached));
        dispatch(sortCoinsAction());
      });
    } catch (error) {}
  }
);

export const syncCoinsStateAction = createAsyncThunk<void, (Coin.ResponseItem & Coin.ExtraRow)[], AsyncThunkConfig>(
  'coin/syncCoinsStateAction',
  async (coins, { dispatch, getState }) => {
    try {
      const {
        coin: {
          config: { codeMap },
        },
      } = getState();
      const filterCoins = coins.filter(({ code }) => codeMap[code]);
      dispatch(syncCoinsAction(filterCoins));
    } catch (error) {}
  }
);

export const setRemoteCoinsAction = createAsyncThunk<void, Coin.RemoteCoin[], AsyncThunkConfig>(
  'coin/setRemoteCoinsAction',
  async (newRemoteCoins, { dispatch, getState }) => {
    try {
      const {
        coin: { remoteCoins },
      } = getState();

      const oldRemoteMap = Utils.GetCodeMap(remoteCoins, 'code');
      const newRemoteMap = Utils.GetCodeMap(newRemoteCoins, 'code');
      const remoteMap = { ...oldRemoteMap, ...newRemoteMap };

      dispatch(syncRemoteCoinsMapAction(remoteMap));
    } catch (error) {}
  }
);

export default coinSlice.reducer;
