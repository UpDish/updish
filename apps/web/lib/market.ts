import type {components} from './api.generated';
type S=components['schemas'];
export type Catalog=S['MarketCatalog'];
export type Listing=S['MarketListing'];
export type Investments=S['Investments'];
export type Persona=S['UxPersonaView'];
export const personaChoices=[['investor-new','첫 투자자'],['investor-active','기존 투자자'],['merchant-seongsu','성수 가게 담당자'],['merchant-group','여러 가게 담당자'],['reviewer','검토자'],['operator','운영자']] as const;
