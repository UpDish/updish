'use client';

import {injected} from 'wagmi/connectors';
import type {OnboardAPI,WalletState} from '@web3-onboard/core';
import {UserRejectedRequestError,type EIP1193Provider} from 'viem';
import {giwaSepolia} from '../../../packages/chain-config/giwa';

const storageKey='updish.wallet-label';
let sdk:Promise<OnboardAPI>|undefined;
let selected:WalletState|undefined;
let restoring:Promise<void>|undefined;
export const qrWalletEnabled=!!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

async function onboard() {
  if(!sdk) sdk=(async()=>{
    const [{default:init},{default:injectedWallets}]=await Promise.all([import('@web3-onboard/core'),import('@web3-onboard/injected-wallets')]);
    const wallets=[injectedWallets()];
    const projectId=process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
    if(projectId) {
      const {default:walletConnect}=await import('@web3-onboard/walletconnect');
      wallets.push(walletConnect({projectId,requiredChains:[giwaSepolia.id],optionalChains:[],dappUrl:window.location.origin}));
    }
    return init({wallets,chains:[{id:giwaSepolia.id,token:'ETH',label:giwaSepolia.name,rpcUrl:giwaSepolia.rpcUrls.default.http[0]}],
      appMetadata:{name:'UpDish',description:'음식점 매출배분 모의 청약',explore:window.location.origin},
      accountCenter:{desktop:{enabled:false},mobile:{enabled:false}},
      connect:{showSidebar:false,autoConnectLastWallet:false},disableFontDownload:true,
      i18n:{en:{connect:{selectingWallet:{header:'지갑 선택',sidebar:{subheading:'지갑 연결',paragraph:'지갑을 선택해 연결한 뒤 로그인 서명을 진행합니다.',IDontHaveAWallet:'지갑이 없어요'},installWallet:'설치된 지갑이 없습니다. Chrome·Edge에 MetaMask를 설치해 주세요.',whyDontISeeMyWallet:'지갑이 보이지 않나요?',learnMore:'설치 안내'},connectingWallet:{header:'{wallet} 연결',mainText:'지갑에서 연결을 승인해 주세요.',paragraph:'연결할 계정을 확인해 주세요.',rejectedText:'지갑 연결을 취소했습니다.',rejectedCTA:'다시 시도',primaryButton:'지갑 선택으로 돌아가기'},connectedWallet:{header:'지갑 연결 완료',mainText:'연결 완료'}}}},
      theme:{'--w3o-background-color':'#ffffff','--w3o-foreground-color':'#f4f6f9','--w3o-text-color':'#252a31','--w3o-border-color':'#dfe3e8','--w3o-action-color':'#1763b6','--w3o-border-radius':'4px','--w3o-font-family':'"Malgun Gothic", sans-serif'},
    });
  })().catch(error=>{sdk=undefined;throw error;});
  return sdk;
}
async function restore() {
  if(typeof window==='undefined'||selected)return;
  const label=window.localStorage.getItem(storageKey);
  if(!label)return;
  if(!restoring)restoring=(async()=>{const api=await onboard();selected=(await api.connectWallet({autoSelect:{label,disableModals:true}}))[0];})().finally(()=>{restoring=undefined;});
  await restoring;
}

// The standard modal chooses a provider; wagmi retains its account/chain events and SIWE signing.
export async function selectWallet() {
  const api=await onboard();selected=(await api.connectWallet())[0];
  if(!selected)throw new UserRejectedRequestError(new Error('지갑 선택을 취소했습니다.'));
  window.localStorage.setItem(storageKey,selected.label);
}
export function walletModalConnector() {
  const base=injected({target:()=>({id:'updish-wallet',name:'지갑 선택',provider:()=>selected?.provider as EIP1193Provider|undefined})});
  return ((config)=>{
    const connector=base(config);
    return {...connector,
      async getProvider() {await restore();return connector.getProvider.call(this);},
      async disconnect() {
        await connector.disconnect.call(this);
        const wallet=selected;selected=undefined;window.localStorage.removeItem(storageKey);
        if(wallet){const api=await onboard();await api.disconnectWallet({label:wallet.label});}
      },
    };
  }) satisfies typeof base;
}
