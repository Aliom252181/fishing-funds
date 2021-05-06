import React, { createContext, useEffect } from 'react';
import classnames from 'classnames';
import { Tabs } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useRequest } from 'ahooks';

import FundList from '@/components/Home/FundList';
import ZindexList from '@/components/Home/ZindexList';
import QuotationList from '@/components/Home/QuotationList';
import Toolbar from '@/components/Toolbar';
import Wallet from '@/components/Wallet/index';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SortBar from '@/components/SortBar';
import TabsBar from '@/components/TabsBar';
import { SET_REMOTE_FUNDS } from '@/actions/fund';
import { StoreState } from '@/reducers/types';
import { useNativeThemeColor } from '@/utils/hooks';
import * as Enums from '@/utils/enums';
import * as Services from '@/services';
import * as CONST from '@/constants';
import styles from './index.scss';

export interface HomeProps {}

// 由于 darkModeListener 花销过大，需使用全局单一监听即可

export const HomeContext = createContext<{
  varibleColors: any;
  darkMode: boolean;
}>({
  varibleColors: {},
  darkMode: false,
});

const Home: React.FC<HomeProps> = () => {
  const dispatch = useDispatch();
  const tabsActiveKey = useSelector(
    (state: StoreState) => state.tabs.activeKey
  );

  useRequest(Services.Fund.GetRemoteFundsFromEastmoney, {
    pollingInterval: 1000 * 60 * 60 * 24,
    throwOnError: true,
    onSuccess: (result) => {
      dispatch({
        type: SET_REMOTE_FUNDS,
        payload: result,
      });
    },
  });

  const { colors: varibleColors, darkMode } = useNativeThemeColor(
    CONST.VARIBLES
  );

  return (
    <HomeContext.Provider
      value={{
        darkMode,
        varibleColors,
      }}
    >
      <div className={classnames(styles.layout)}>
        <Header>
          <Wallet />
          <SortBar />
        </Header>
        <Tabs
          defaultActiveKey={String(tabsActiveKey)}
          renderTabBar={() => <></>}
          activeKey={String(tabsActiveKey)}
          animated={{ tabPane: true, inkBar: false }}
        >
          <Tabs.TabPane key={Enums.TabKeyType.Funds} forceRender>
            <FundList />
          </Tabs.TabPane>
          <Tabs.TabPane key={Enums.TabKeyType.Zindex} forceRender>
            <ZindexList />
          </Tabs.TabPane>
          <Tabs.TabPane key={Enums.TabKeyType.Quotation} forceRender>
            <QuotationList />
          </Tabs.TabPane>
        </Tabs>
        <Footer>
          <Toolbar />
          <TabsBar />
        </Footer>
        <webview
          src="https://ff.1zilc.top/collect?title=home"
          style={{ height: 1080, width: 1920, display: 'none' }}
        ></webview>
      </div>
    </HomeContext.Provider>
  );
};

export default Home;
