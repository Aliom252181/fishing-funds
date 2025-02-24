import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { batch } from 'react-redux';
import dayjs from 'dayjs';

import { TypedThunk } from '@/store';
import { setWalletConfigAction, updateWalletStateAction, setWalletStateAction } from '@/store/features/wallet';
import * as Utils from '@/utils';
import * as CONST from '@/constants';
import * as Helpers from '@/helpers';
import * as Enums from '@/utils/enums';

export interface FundState {
  fundsLoading: boolean;
  remoteFunds: Fund.RemoteFund[];
  remoteFundsLoading: boolean;
  fundRatingMap: Record<string, Fund.RantingItem>;
}

const initialState: FundState = {
  fundsLoading: false,
  remoteFunds: [],
  remoteFundsLoading: false,
  fundRatingMap: {},
};

const fundSlice = createSlice({
  name: 'fund',
  initialState,
  reducers: {
    syncRemoteFundsAction(state, action: PayloadAction<Fund.RemoteFund[]>) {
      state.remoteFunds = action.payload;
    },
    setFundsLoadingAction(state, action: PayloadAction<boolean>) {
      state.fundsLoading = action.payload;
    },
    setRemoteFundsLoadingAction(state, action: PayloadAction<boolean>) {
      state.remoteFundsLoading = action.payload;
    },
    syncFundRatingMapAction(state, action) {
      state.fundRatingMap = action.payload;
    },
  },
});

export const { syncRemoteFundsAction, setFundsLoadingAction, setRemoteFundsLoadingAction, syncFundRatingMapAction } = fundSlice.actions;

export function setFundConfigAction(config: Fund.SettingItem[], walletCode: string): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        wallet: {
          config: { walletConfig },
          currentWallet,
        },
      } = getState();
      const newWalletConfig = walletConfig.map((item) => ({
        ...item,
        funds: walletCode === item.code ? config : item.funds,
      }));

      batch(() => {
        dispatch(setWalletConfigAction(newWalletConfig));
        dispatch(updateWalletStateAction(currentWallet));
      });
    } catch (error) {}
  };
}

export function setRemoteFundsAction(newRemoteFunds: Fund.RemoteFund[]): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        fund: { remoteFunds },
      } = getState();
      const oldRemoteMap = Utils.GetCodeMap(remoteFunds, 0);
      const newRemoteMap = Utils.GetCodeMap(newRemoteFunds, 0);
      const remoteMap = { ...oldRemoteMap, ...newRemoteMap };
      dispatch(syncRemoteFundsAction(Object.values(remoteMap)));
      Utils.SetStorage(CONST.STORAGE.REMOTE_FUND_MAP, remoteMap);
    } catch (error) {}
  };
}

export function setFundRatingMapAction(newFundRantings: Fund.RantingItem[]): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        fund: { fundRatingMap: oldFundRatingMap },
      } = getState();

      const nweFundRantingMap = Utils.GetCodeMap(newFundRantings, 'code');
      const fundRatingMap = { ...oldFundRatingMap, ...nweFundRantingMap };
      Utils.SetStorage(CONST.STORAGE.FUND_RATING_MAP, fundRatingMap);

      dispatch(syncFundRatingMapAction(fundRatingMap));
    } catch (error) {}
  };
}

export function addFundAction(fund: Fund.SettingItem): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        wallet: { currentWalletCode, fundConfig },
      } = getState();
      const exist = fundConfig.find((item) => fund.code === item.code);
      if (!exist) {
        dispatch(setFundConfigAction(fundConfig.concat(fund), currentWalletCode));
      }
    } catch (error) {}
  };
}

export function updateFundAction(fund: {
  code: string;
  cyfe?: number;
  name?: string;
  cbj?: number;
  zdfRange?: number;
  jzNotice?: number;
  memo?: string;
}): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        wallet: { currentWalletCode, fundConfig },
      } = getState();
      const cloneFundConfig = Utils.DeepCopy(fundConfig);
      cloneFundConfig.forEach((item) => {
        if (fund.code === item.code) {
          Object.keys(fund).forEach((key) => {
            (item[key as keyof Fund.SettingItem] as any) = fund[key as keyof Fund.SettingItem];
          });
        }
      });

      dispatch(setFundConfigAction(cloneFundConfig, currentWalletCode));
    } catch (error) {}
  };
}

export function deleteFundAction(code: string): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        wallet: { currentWalletCode, fundConfig },
      } = getState();
      fundConfig.forEach((item, index) => {
        if (code === item.code) {
          const cloneFundConfig = Utils.DeepCopy(fundConfig);
          cloneFundConfig.splice(index, 1);
          dispatch(setFundConfigAction(cloneFundConfig, currentWalletCode));
        }
      });
    } catch (error) {}
  };
}

export function sortFundsAction(walletCode: string): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        wallet: {
          wallets,
          config: { walletConfig },
        },
        sort: {
          sortMode: {
            fundSortMode: { type: fundSortType, order: fundSortorder },
          },
        },
      } = getState();
      const { funds, updateTime, code } = Helpers.Wallet.GetCurrentWalletState(walletCode, wallets);
      const { codeMap } = Helpers.Fund.GetFundConfig(walletCode, walletConfig);
      const sortList = funds.slice();

      sortList.sort((a, b) => {
        const calcA = Helpers.Fund.CalcFund(a, codeMap);
        const calcB = Helpers.Fund.CalcFund(b, codeMap);
        const t = fundSortorder === Enums.SortOrderType.Asc ? 1 : -1;

        switch (fundSortType) {
          case Enums.FundSortType.Growth:
            return (Number(calcA.gszzl) - Number(calcB.gszzl)) * t;
          case Enums.FundSortType.Cost:
            return (Number(calcA.cbje || 0) - Number(calcB.cbje || 0)) * t;
          case Enums.FundSortType.Money:
            return (Number(calcA.jrsygz) - Number(calcB.jrsygz)) * t;
          case Enums.FundSortType.Estimate:
            return (Number(calcA.gszz) - Number(calcB.gszz)) * t;
          case Enums.FundSortType.Income:
            return (Number(calcA.cysy || 0) - Number(calcB.cysy || 0)) * t;
          case Enums.FundSortType.IncomeRate:
            return (Number(calcA.cysyl) - Number(calcB.cysyl || 0)) * t;
          case Enums.FundSortType.Name:
            return calcA.name!.localeCompare(calcB.name!, 'zh') * t;
          case Enums.FundSortType.Custom:
          default:
            return (codeMap[b.fundcode!]?.originSort - codeMap[a.fundcode!]?.originSort) * t;
        }
      });

      dispatch(setWalletStateAction({ code, funds: sortList, updateTime }));
    } catch (error) {}
  };
}

export function sortFundsCachedAction(responseFunds: Fund.ResponseItem[], walletCode: string): TypedThunk {
  return (dispatch, getState) => {
    try {
      const {
        wallet: {
          config: { walletConfig },
          wallets,
        },
      } = getState();
      const { fundConfig } = Helpers.Fund.GetFundConfig(walletCode, walletConfig);
      const { funds } = Helpers.Wallet.GetCurrentWalletState(walletCode, wallets);
      const now = dayjs().format('MM-DD HH:mm:ss');
      const fundsCodeToMap = Utils.GetCodeMap(funds, 'fundcode');
      const fundsWithChached = responseFunds.map((_) => ({
        ...(fundsCodeToMap[_.fundcode!] || {}),
        ..._,
      }));
      const fundsWithChachedCodeToMap = Utils.GetCodeMap(fundsWithChached, 'fundcode');
      fundConfig.forEach((fund) => {
        const responseFund = fundsWithChachedCodeToMap[fund.code];
        const stateFund = fundsCodeToMap[fund.code];
        if (!responseFund && stateFund) {
          fundsWithChached.push(stateFund);
        }
      });

      batch(() => {
        dispatch(setWalletStateAction({ code: walletCode, funds: fundsWithChached, updateTime: now }));
        dispatch(sortFundsAction(walletCode));
      });
    } catch (error) {}
  };
}

export default fundSlice.reducer;
