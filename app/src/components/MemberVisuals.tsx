import { useState } from 'react';
export function MemberAvatar({name,src}:{name:string;src?:string|null}) {
  const [failed,setFailed]=useState(false);
  const initials=name.trim().split(/\s+/).map(p=>Array.from(p)[0]).slice(0,2).join('');
  return <span className="unity-avatar">{src&&!failed?<img src={src} alt="" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{initials}</span>}</span>;
}
// Illustrative covers are labelled in the UI; real event records still come from the API.
export function eventCover(title:string) {
  const q=title.toLowerCase();
  if(/library|youth|workshop|learn/.test(q))return '/gallery/reading.webp';
  if(/plant|farm|palmyra|agricultur/.test(q))return '/gallery/fields.webp';
  if(/water|nallur|kovil/.test(q))return '/gallery/nallur.webp';
  if(/convention|district|hall/.test(q))return '/gallery/library.webp';
  return '/gallery/kilinochchi.webp';
}
