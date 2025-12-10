import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';

interface TokenChartProps {
  data: CandlestickData[];
  loading?: boolean;
}

/**
 * TokenChart Component
 * --------------------
 * Displays a candlestick chart using TradingView Lightweight Charts
 * Dark mode styling with green/red candles
 */
export const TokenChart: React.FC<TokenChartProps> = ({ data, loading = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [isChartReady, setIsChartReady] = React.useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    console.log('Initializing chart...');

    // Create chart instance
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#2b2b43',
      },
      timeScale: {
        borderColor: '#2b2b43',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series (v5 API)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries as any;
    
    console.log('Chart initialized successfully');
    setIsChartReady(true);

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      setIsChartReady(false);
    };
  }, []);

  // Update chart data when it changes
  useEffect(() => {
    console.log('TokenChart received data:', data);
    console.log('Data length:', data?.length);
    console.log('Series ref exists:', !!seriesRef.current);
    console.log('Chart ready:', isChartReady);
    
    if (isChartReady && seriesRef.current && data && data.length > 0) {
      console.log('Setting chart data...');
      try {
        seriesRef.current.setData(data);
        
        // Fit content to visible range
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
        console.log('✅ Chart data set successfully');
      } catch (error) {
        console.error('❌ Error setting chart data:', error);
      }
    } else {
      console.log('⏳ Waiting for chart to be ready or data to arrive...');
    }
  }, [data, isChartReady]);

  return (
    <div className="relative">
      {/* Always render the chart container so it can initialize */}
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
      
      {/* Show loading/empty state overlay when needed */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] rounded-lg">
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      )}
      
      {!loading && (!data || data.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] rounded-lg">
          <div className="text-gray-400">No chart data available</div>
        </div>
      )}
    </div>
  );
};