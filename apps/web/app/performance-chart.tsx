'use client';

import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {won} from '../lib/workbench';

export type ChartPoint={period:string;version:number;amount:string;value:number};
export default function PerformanceChart({points,label}:{points:ChartPoint[];label:string}) {
  return <div className="performance-plot" aria-label={`${label} 월별 차트. 정확한 값은 아래 표에서 확인할 수 있습니다.`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points} margin={{top:16,right:16,bottom:8,left:2}} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#e5e9ef"/>
        <XAxis dataKey="period" tick={{fontSize:11}} tickLine={false} axisLine={{stroke:'#dce1e8'}}/>
        <YAxis width={66} tick={{fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>Number(v).toLocaleString('ko-KR',{notation:'compact'})} domain={[0,'auto']}/>
        <Tooltip cursor={{fill:'#f0f4fa'}} content={({active,payload})=>{
          const point=payload?.[0]?.payload as ChartPoint|undefined;
          return active&&point?<div className="performance-tooltip"><b>{point.period} · v{point.version}</b><span>{label} {won(point.amount)}</span></div>:null;
        }}/>
        <Bar dataKey="value" name={label} fill="#1763b6" maxBarSize={64} isAnimationActive={false}/>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
