'use client';
import {useQuery} from '@tanstack/react-query';
import {api} from './auth';
export type DemoScenario={id:string;label:string;period:string;filename:string;description:string;expectedNetWon:string;ready:boolean;expectedIssueCodes:string[];history:boolean;workflow:boolean;sha256:string};
export type DemoCatalog={schemaVersion:1;mode:'SIMULATION';storeName:string;description:string;scenarios:DemoScenario[]};
export function useDemoSamples(){return useQuery({queryKey:['demo-catalog'],queryFn:()=>api<DemoCatalog>('/samples/catalog.json'),staleTime:300_000,retry:false});}
export function sampleUrl(scenario:DemoScenario){return `/samples/${encodeURIComponent(scenario.filename)}`;}
