'use client';
import {Modal} from './modal';
const steps=[
  {id:'market',title:'가게와 계약 확인',detail:'성수 모퉁이의 매출 근거·계약 조건·위험 안내를 보여줍니다.'},
  {id:'market',title:'100단위 모의 청약',detail:'청약 팝업에서 100만원 / 100단위를 신청합니다. 운영자는 배경 3,500단위를 준비하고 배정합니다.'},
  {id:'benefits',title:'투자자 고객 혜택',detail:'배정된 보유에 따른 혜택을 확인합니다. 쿠폰은 모의이며 주문·충전·실제 결제는 시연 범위 밖입니다.'},
  {id:'merchant',title:'매출 CSV 대조',detail:'정상 CSV를 제출하고 중복·할인·환불을 대조합니다. 제출자와 다른 검토 지갑으로 마감합니다.'},
  {id:'operations',title:'정산 산정·승인',detail:'정산대상 매출 3,000만원 × 3% = 90만원. 100 / 3,600단위의 세전 의무액은 25,000원입니다.'},
  {id:'investments',title:'명세와 예외 확인',detail:'정산 상세 팝업에서 산식·지급·미지급을 확인합니다. 현금 부족·정정·모집 미달 예시도 구분합니다.'},
  {id:'agent',title:'Agent에게 근거 질문',detail:'승인된 내 명세를 선택해 질문합니다. 모델이 미연결이면 답변 성공으로 표시하지 않습니다.'},
];
export function DemoGuide({onClose,onGo,sections}:{onClose:()=>void;onGo:(tab:string)=>void;sections:string[]}){return <Modal title="Demo 시연 순서" description="기능을 나열하기보다, 하나의 투자·정산 흐름을 보여줍니다." wide onClose={onClose}><ol className="demo-step-list">{steps.map((s,i)=><li key={s.title}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{s.title}</h3><p>{s.detail}</p></div><button className="secondary small" disabled={!sections.includes(s.id)} onClick={()=>onGo(s.id)}>화면 이동</button></li>)}</ol><p className="hint">이 안내의 25,000원은 정상 시나리오 기준 예시입니다. 버튼은 화면만 이동하며 배정·승인·지급을 자동 실행하지 않습니다. 실제 권한과 별도 승인 지갑 검사를 유지합니다.</p></Modal>;}
