import {coreGet} from '../../../../lib/core';
export async function GET() {return coreGet('/api/v1/offerings/current/performance');}
