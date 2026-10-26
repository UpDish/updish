import type {components} from './api.generated';
type S=components['schemas'];
export type Catalog=S['MarketCatalog'];
export type Listing=S['MarketListing'];
export type Investments=S['Investments'];
export type Benefits=S['CustomerBenefits'];
export type Persona=S['UxPersonaView'];
export const benefitLabels:Record<string,string>={AVAILABLE:'수령 가능',LOCKED:'보유 조건 미충족',CLAIMED:'수령 완료',USED:'사용 완료',EXPIRED:'기간 만료',UPCOMING:'오픈 예정',SOLD_OUT:'소진'};
export const personaChoices=[['investor-new','첫 투자자'],['investor-active','기존 투자자'],['merchant-seongsu','성수 가게 담당자'],['merchant-group','여러 가게 담당자'],['customer-only','고객'],['reviewer','검토자'],['operator','운영자']] as const;
