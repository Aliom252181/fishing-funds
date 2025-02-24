import React, { useState } from 'react';
import { useRequest } from 'ahooks';
import ChartCard from '@/components/Card/ChartCard';
import PictureImage from '@/static/img/picture.svg';
import PictureFailedImage from '@/static/img/picture-failed.svg';
import * as Services from '@/services';
import * as CONST from '@/constants';
import styles from './index.module.scss';

export interface EstimateProps {
  code: string;
}
const Estimate: React.FC<EstimateProps> = ({ code }) => {
  const [estimate, setEstimate] = useState<string | null>('');
  const { run: runGetEstimatedFromEastmoney } = useRequest(() => Services.Fund.GetEstimatedFromEastmoney(code), {
    pollingInterval: CONST.DEFAULT.ESTIMATE_FUND_DELAY,
    onSuccess: setEstimate,
    refreshDeps: [code],
  });

  return (
    <ChartCard onFresh={runGetEstimatedFromEastmoney}>
      <div className={styles.estimate}>
        {estimate === '' ? (
          <PictureImage />
        ) : estimate === null ? (
          <PictureFailedImage />
        ) : (
          <img src={estimate} onError={() => setEstimate(null)} />
        )}
      </div>
    </ChartCard>
  );
};

export default Estimate;
