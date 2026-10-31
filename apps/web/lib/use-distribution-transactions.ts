'use client';
import {useRef,useState} from 'react';
import {useConnection,usePublicClient,useWalletClient} from 'wagmi';
import {erc20Abi,parseAbi,keccak256,stringToHex,type Address,type Hex} from 'viem';
import {giwaSepolia} from '../../../packages/chain-config/giwa';
import {api} from './auth';
import {command,type Job,type Offering} from './workbench';
import type {Distributions} from './distributions';

export function useDistributionTransactions(o:Offering,onRefresh:()=>Promise<void>,onNotice:(s:string)=>void){
  const connection=useConnection(),{data:wallet}=useWalletClient(),publicClient=usePublicClient({chainId:91342});
  const [busy,setBusy]=useState(false);const locked=useRef(false);
  const key=`updish.jobs.v1.${o.run_id}`;
  async function send(job:Job){
    if(locked.current)return;
    if(!wallet||!publicClient||!connection.address||connection.chainId!==91342){onNotice('GIWA Sepolia의 운영 지갑을 연결해 주세요.');return;}
    if(job.status==='SAFE'){onNotice('이미 safe 확인을 마친 거래입니다. 다시 송금하지 않습니다.');return;}
    locked.current=true;setBusy(true);
    try{
      const saved=JSON.parse(localStorage.getItem(key)??'{}') as Record<string,Hex>;
      let hash=job.tx_hash??saved[job.id];
      if(!hash){
        const prepared=await command<Job>(`jobs/${job.id}/prepare`);
        if(prepared.tx_hash)hash=prepared.tx_hash;
        else{
          if(prepared.status!=='AWAITING_SIGNATURE'||!prepared.target||!prepared.calldata)throw new Error('거래 준비 상태를 확인해 주세요.');
          if(job.kind==='FUND_DISTRIBUTION'){
            const history=await api<Distributions>('/api/workbench/distributions');
            const intent=history.payments.find(p=>p.id===job.id);if(!intent)throw new Error('예치 근거를 찾지 못했습니다.');
            const cash=intent.cash_address as Address,vault=intent.vault_address as Address;
            const period=keccak256(stringToHex(`updish-distribution:${o.id}:${intent.period}`));
            const state=await publicClient.readContract({address:vault,abi:parseAbi(['function periods(bytes32) view returns (bytes32,uint256,uint256,uint256)']),functionName:'periods',args:[period]});
            const amount=BigInt(intent.amount_units)>state[2]?BigInt(intent.amount_units)-state[2]:0n;
            const approvalKey=`updish.approval.v1.${o.id}.${job.id}`;
            const previous=localStorage.getItem(approvalKey) as Hex|null;
            if(previous){const receipt=await publicClient.waitForTransactionReceipt({hash:previous,timeout:120_000});localStorage.removeItem(approvalKey);if(receipt.status!=='success')throw new Error('이전 DEMO 사용 승인이 실패했습니다. 확인 후 다시 진행해 주세요.');}
            const allowance=await publicClient.readContract({address:cash,abi:erc20Abi,functionName:'allowance',args:[connection.address,vault]});
            if(allowance<amount){
              onNotice(`지갑에서 ${amount.toLocaleString()} DEMO의 분배 계약 사용 승인을 확인해 주세요. 무제한 승인이 아닙니다.`);
              const approval=await wallet.writeContract({address:cash,abi:erc20Abi,functionName:'approve',args:[vault,amount],account:connection.address,chain:giwaSepolia});
              localStorage.setItem(approvalKey,approval);
              const receipt=await publicClient.waitForTransactionReceipt({hash:approval,timeout:120_000});localStorage.removeItem(approvalKey);
              if(receipt.status!=='success')throw new Error('DEMO 사용 승인이 실패했습니다. 예치하지 않았습니다.');
            }
          }
          onNotice(job.kind==='FUND_DISTRIBUTION'?'지갑에서 테스트 자산 예치를 확인해 주세요.':'지갑에서 수신 주소와 DEMO 분배 수량을 확인해 주세요.');
          hash=await wallet.sendTransaction({to:prepared.target as Address,data:prepared.calldata as Hex,account:connection.address,chain:giwaSepolia,value:0n});
          saved[job.id]=hash;localStorage.setItem(key,JSON.stringify(saved));
        }
      }
      const attached=await command<Job>(`jobs/${job.id}/transaction`,{hash});
      onNotice(attached.status==='SAFE'?'거래 영수증과 safe 상태를 확인했습니다.':'거래를 제출했습니다. 블록 포함과 safe 반영을 따로 확인합니다.');
    }catch(e){onNotice(e instanceof Error?e.message.split('\n')[0]:'거래 상태를 확인하지 못했습니다.');}
    finally{locked.current=false;setBusy(false);await onRefresh();}
  }
  async function check(job:Pick<Job,'id'>){if(locked.current)return;locked.current=true;setBusy(true);try{const result=await command<Job>(`jobs/${job.id}/check`);onNotice(result.status==='SAFE'?'테스트 자산의 safe 반영을 확인했습니다.':'아직 확정되지 않았습니다. 같은 거래를 다시 보내지 않고 상태를 확인해 주세요.');}catch(e){onNotice(e instanceof Error?e.message:'확인 실패');}finally{locked.current=false;setBusy(false);await onRefresh();}}
  return {busy,send,check};
}
