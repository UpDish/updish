import Workspace from './workspace';
import {Suspense} from 'react';
export default function Page() { return <Suspense fallback={<main><p role="status">화면을 불러오고 있습니다…</p></main>}><Workspace /></Suspense>; }
