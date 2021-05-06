import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { useInterval, useBoolean } from 'ahooks';
import { ipcRenderer, remote, clipboard } from 'electron';
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector } from 'react-redux';

import { getSystemSetting } from '@/actions/setting';
import { getCurrentHours } from '@/actions/time';
import { updateAvaliable } from '@/actions/updater';
import {
  getFundConfig,
  getFunds,
  updateFund,
  setFundConfig,
  getCodeMap,
} from '@/actions/fund';
import { StoreState } from '@/reducers/types';
import * as Utils from '@/utils';
import * as CONST from '@/constants';

const { nativeTheme, dialog } = remote;

export function useWorkDayTimeToDo(
  todo: () => void,
  delay: number,
  config?: { immediate: boolean }
): void {
  useInterval(
    async () => {
      const timestamp = await getCurrentHours();
      const isWorkDayTime = Utils.JudgeWorkDayTime(Number(timestamp));
      if (isWorkDayTime) {
        todo();
      }
    },
    delay,
    config
  );
}

export function useFixTimeToDo(
  todo: () => void,
  delay: number,
  config?: { immediate: boolean }
): void {
  useInterval(
    async () => {
      const timestamp = await getCurrentHours();
      const isFixTime = Utils.JudgeFixTime(Number(timestamp));
      if (isFixTime) {
        todo();
      }
    },
    delay,
    config
  );
}

export function useScrollToTop(
  config: {
    before?: () => void;
    after?: () => void;
    option?: {
      behavior?: ScrollBehavior;
      left?: number;
      top?: number;
    };
  },
  dep: any[] = []
) {
  return useCallback(() => {
    const { before, after, option } = config;
    before && before();
    window.scrollTo({
      behavior: 'smooth',
      top: 0,
      ...option,
    });
    after && after();
  }, dep);
}

export function useUpdater() {
  const dispatch = useDispatch();
  const { autoCheckUpdateSetting } = getSystemSetting();
  // 一个小时检查一次版本
  useInterval(
    () => autoCheckUpdateSetting && ipcRenderer.send('check-update'),
    1000 * 60 * 60 * 1,
    {
      immediate: true,
    }
  );
  useLayoutEffect(() => {
    ipcRenderer.on('update-available', (e, data) =>
      dispatch(updateAvaliable(data))
    );
    return () => {
      ipcRenderer.removeAllListeners('update-available');
    };
  }, []);
}

export function useConfigClipboard() {
  useLayoutEffect(() => {
    ipcRenderer.on('clipboard-funds-import', async (e, data) => {
      const limit = 1024;
      try {
        const text = clipboard.readText();
        const json: any[] = JSON.parse(text);
        if (json.length > limit) {
          dialog.showMessageBox({
            type: 'info',
            title: `超过最大限制`,
            message: `最大${limit}个`,
          });
          return;
        }
        const fundConfig = json
          .map((fund) => ({
            name: '',
            cyfe: Number(fund.cyfe) || 0,
            code: fund.code && String(fund.code),
          }))
          .filter(({ code }) => code);
        const codeMap = getCodeMap(fundConfig);
        // 去重复
        const fundConfigSet = Object.entries(codeMap).map(
          ([code, fund]) => fund
        );
        const responseFunds = await getFunds(fundConfigSet);
        const _fundConfig = responseFunds
          .filter((_) => !!_)
          .map((fund) => ({
            name: fund?.name!,
            code: fund?.fundcode!,
            cyfe: codeMap[fund?.fundcode!].cyfe,
          }));
        setFundConfig(_fundConfig);
        dialog.showMessageBox({
          type: 'info',
          title: `导入完成`,
          message: `更新：${_fundConfig.length}个，总共：${json.length}个`,
        });
      } catch (error) {
        console.log('基金json解析失败', error);
        dialog.showMessageBox({
          type: 'info',
          title: `基金JSON解析失败`,
          message: `请检查JSON格式`,
        });
      }
    });
    ipcRenderer.on('clipboard-funds-copy', (e, data) => {
      try {
        const { fundConfig } = getFundConfig();
        clipboard.writeText(JSON.stringify(fundConfig));
      } catch (error) {
        console.log('复制基金json失败', error);
      }
    });
    return () => {
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('clipboard-funds-import');
    };
  }, []);
}

export function useNativeTheme() {
  const [darkMode, setDarkMode] = useState(nativeTheme.shouldUseDarkColors);
  useLayoutEffect(() => {
    const { systemThemeSetting } = getSystemSetting();
    const listener = ipcRenderer.on('nativeTheme-updated', (e, data) => {
      setDarkMode(data.darkMode);
    });
    Utils.UpdateSystemTheme(systemThemeSetting);
    return () => {
      listener.removeAllListeners('nativeTheme-updated');
    };
  }, []);
  return { darkMode };
}

export function useNativeThemeColor(varibles: string[]) {
  const { darkMode } = useNativeTheme();
  const memoColors = useMemo(() => Utils.getVariblesColor(varibles), [
    darkMode,
  ]);
  return { darkMode, colors: memoColors };
}

export function useEchartResize() {}

export function useActions(actions: any, deps?: any[]) {
  const dispatch = useDispatch();
  return useMemo(
    () => {
      if (Array.isArray(actions)) {
        return actions.map((a) => bindActionCreators(a, dispatch));
      }
      return bindActionCreators(actions, dispatch);
    },
    deps ? [dispatch, ...deps] : [dispatch]
  );
}

export function useSyncFixFundSetting() {
  const [done, { setTrue }] = useBoolean(false);

  async function FixFundSetting(fundConfig: Fund.SettingItem[]) {
    try {
      const responseFunds = await getFunds(fundConfig);

      responseFunds
        .filter((_) => !!_)
        .forEach((responseFund) => {
          updateFund({
            code: responseFund?.fundcode!,
            name: responseFund?.name,
          });
        });
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    const { fundConfig } = getFundConfig();
    const unNamedFunds = fundConfig.filter(({ name }) => !name);
    if (unNamedFunds.length) {
      FixFundSetting(unNamedFunds).finally(() => {
        setTrue();
      });
    } else {
      setTrue();
    }
  }, []);

  return { done };
}

export function useAdjustmentNotification() {
  const { adjustmentNotificationSetting } = getSystemSetting();
  useInterval(
    async () => {
      if (!adjustmentNotificationSetting) {
        return;
      }
      const timestamp = await getCurrentHours();
      const {
        isAdjustmentNotificationTime,
        now,
      } = Utils.JudgeAdjustmentNotificationTime(Number(timestamp));
      const month = now.get('month');
      const date = now.get('date');
      const hour = now.get('hour');
      const minute = now.get('minute');
      const currentDate = `${month}-${date}`;
      const lastNotificationDate = Utils.GetStorage(
        CONST.STORAGE.ADJUSTMENT_NOTIFICATION_DATE,
        ''
      );
      if (
        isAdjustmentNotificationTime &&
        currentDate !== lastNotificationDate
      ) {
        const notification = new Notification('调仓提醒', {
          body: `当前时间${hour}:${minute} 注意行情走势`,
        });
        notification.onclick = () => {
          remote.getCurrentWindow().show();
        };
        Utils.SetStorage(
          CONST.STORAGE.ADJUSTMENT_NOTIFICATION_DATE,
          currentDate
        );
      }
    },
    1000 * 60 * 5,
    {
      immediate: true,
    }
  );
}

export function useCurrentWallet() {
  const wallets = useSelector((state: StoreState) => state.wallet.wallets);
  const currentWalletCode = useSelector(
    (state: StoreState) => state.wallet.currentWalletCode
  );
  const walletsMap = useSelector(
    (state: StoreState) => state.wallet.walletsMap
  );
  const currentWallet =
    wallets.filter(({ code }) => currentWalletCode === code)[0] || {};
  const currentWalletState = walletsMap[currentWalletCode] || {};

  return {
    currentWallet,
    currentWalletCode,
    wallets,
    walletsMap,
    currentWalletState,
  };
}
