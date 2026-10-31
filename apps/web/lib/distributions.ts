import type {components} from './api.generated';
export type Distributions=components['schemas']['Distributions'];
export type DistributionReceipt=components['schemas']['DistributionReceipt'];
export function demoUnits(value:bigint|string|number){return BigInt(value).toLocaleString('ko-KR')+' DEMO';}
