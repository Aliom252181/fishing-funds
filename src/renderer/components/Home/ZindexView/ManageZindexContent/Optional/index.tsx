import React, { useMemo } from 'react';

import { ReactSortable } from 'react-sortablejs';
import clsx from 'clsx';

import PureCard from '@/components/Card/PureCard';
import AddIcon from '@/static/icon/add.svg';
import MenuIcon from '@/static/icon/menu.svg';
import RemoveIcon from '@/static/icon/remove.svg';
import CustomDrawer from '@/components/CustomDrawer';
import Empty from '@/components/Empty';
import { deleteZindexAction, setZindexConfigAction } from '@/store/features/zindex';
import { useDrawer, useAutoDestroySortableRef, useAppDispatch, useAppSelector } from '@/utils/hooks';

import styles from './index.module.scss';

const AddZindexContent = React.lazy(() => import('@/components/Home/ZindexView/AddZindexContent'));

export interface OptionalProps {}

const { dialog } = window.contextModules.electron;

const Optional: React.FC<OptionalProps> = () => {
  const dispatch = useAppDispatch();
  const sortableRef = useAutoDestroySortableRef();
  const { codeMap, zindexConfig } = useAppSelector((state) => state.zindex.config);
  const { show: showAddDrawer, set: setAddDrawer, close: closeAddDrawer } = useDrawer(null);
  const sortZindexConfig = useMemo(() => zindexConfig.map((_) => ({ ..._, id: _.code })), [zindexConfig]);

  function onSortZindexConfig(sortList: Zindex.SettingItem[]) {
    const zindexConfig = sortList.map((item) => {
      const zindex = codeMap[item.code];
      return {
        name: zindex.name,
        code: zindex.code,
      };
    });
    dispatch(setZindexConfigAction(zindexConfig));
  }

  async function onRemoveZindex(zindex: Zindex.SettingItem) {
    const { response } = await dialog.showMessageBox({
      title: '删除指数',
      type: 'info',
      message: `确认删除 ${zindex.name || ''} ${zindex.code}`,
      buttons: ['确定', '取消'],
    });
    if (response === 0) {
      dispatch(deleteZindexAction(zindex.code));
    }
  }

  return (
    <div className={styles.content}>
      {sortZindexConfig.length ? (
        <ReactSortable
          ref={sortableRef}
          animation={200}
          delay={2}
          list={sortZindexConfig}
          setList={onSortZindexConfig}
          dragClass={styles.dragItem}
          swap
        >
          {sortZindexConfig.map((zindex) => {
            const [market, code] = zindex.code.split('.');
            return (
              <PureCard key={zindex.code} className={clsx(styles.row, 'hoverable')}>
                <RemoveIcon
                  className={styles.remove}
                  onClick={(e) => {
                    onRemoveZindex(zindex);
                    e.stopPropagation();
                  }}
                />
                <div className={styles.inner}>
                  <div className={styles.name}>
                    {zindex.name}
                    <span className={styles.code}>（{code}）</span>
                  </div>
                </div>
                <MenuIcon className={styles.menu} />
              </PureCard>
            );
          })}
        </ReactSortable>
      ) : (
        <Empty text="暂未自选指数~" />
      )}
      <div
        className={styles.add}
        onClick={(e) => {
          setAddDrawer(null);
          e.stopPropagation();
        }}
      >
        <AddIcon />
      </div>
      <CustomDrawer show={showAddDrawer}>
        <AddZindexContent onClose={closeAddDrawer} onEnter={closeAddDrawer} />
      </CustomDrawer>
    </div>
  );
};

export default Optional;
