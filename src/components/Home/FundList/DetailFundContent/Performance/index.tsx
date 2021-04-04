import React, { useEffect, useRef, useState, useContext } from 'react';
import classnames from 'classnames';
import { useRequest, useSize } from 'ahooks';
import * as echarts from 'echarts';

import { HomeContext } from '@/components/Home';
import * as Services from '@/services';
import * as Enums from '@/utils/enums';
import styles from './index.scss';

export interface PerformanceProps {
  code: string;
}
const performanceTypeList = [
  { name: '1月', type: Enums.PerformanceType.Month, code: 'm' },
  { name: '3月', type: Enums.PerformanceType.ThreeMonth, code: 'q' },
  { name: '6月', type: Enums.PerformanceType.HalfYear, code: 'hy' },
  { name: '1年', type: Enums.PerformanceType.Year, code: 'y' },
  { name: '3年', type: Enums.PerformanceType.ThreeYear, code: 'try' },
  { name: '最大', type: Enums.PerformanceType.Max, code: 'se' },
];
const Performance: React.FC<PerformanceProps> = ({ code }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(
    null
  );
  const [performanceType, setPerformanceType] = useState(
    performanceTypeList[2]
  );
  const { width: chartRefWidth } = useSize(chartRef);
  const { varibleColors, darkMode } = useContext(HomeContext);
  const { run: runGetFundPerformanceFromEastmoney } = useRequest(
    Services.Fund.GetFundPerformanceFromEastmoney,
    {
      manual: true,
      throwOnError: true,
      cacheKey: `GetFundPerformanceFromEastmoney/${code}/${performanceType.code}`,
      onSuccess: (result) => {
        chartInstance?.setOption({
          title: {
            text: '',
          },
          tooltip: {
            trigger: 'axis',
            position: 'inside',
          },
          legend: {
            data: result?.map(({ name }) => name) || [],
            textStyle: {
              color: varibleColors['--main-text-color'],
              fontSize: 10,
            },
          },
          grid: {
            left: 0,
            right: 5,
            bottom: 0,
            containLabel: true,
          },
          xAxis: {
            type: 'time',
            boundaryGap: false,
            axisLabel: {
              fontSize: 10,
            },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: `{value}%`,
              fontSize: 10,
            },
          },
          dataZoom: [
            {
              type: 'inside',
              minValueSpan: 3600 * 24 * 1000 * 7,
            },
          ],
          series:
            result?.map((_) => ({
              ..._,
              type: 'line',
              showSymbol: false,
              symbol: 'none',
              lineStyle: {
                width: 1,
              },
            })) || [],
        });
      },
    }
  );

  const initChart = () => {
    const chartInstance = echarts.init(chartRef.current!, undefined, {
      renderer: 'svg',
    });
    setChartInstance(chartInstance);
  };

  useEffect(initChart, []);

  useEffect(() => {
    if (chartInstance) {
      runGetFundPerformanceFromEastmoney(code, performanceType.code);
    }
  }, [darkMode, chartInstance, performanceType.code]);

  useEffect(() => {
    chartInstance?.resize({
      height: (chartRefWidth! * 250) / 400,
    });
  }, [chartRefWidth]);

  return (
    <div className={styles.content}>
      <div ref={chartRef} style={{ width: '100%' }}></div>
      <div className={styles.selections}>
        {performanceTypeList.map((item) => (
          <div
            key={item.type}
            className={classnames(styles.selection, {
              [styles.active]: performanceType.type === item.type,
            })}
            onClick={() => setPerformanceType(item)}
          >
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Performance;
