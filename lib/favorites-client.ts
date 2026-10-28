let pending:Promise<string[]>|null=null;
export function favoriteIds(){
  if(!pending)pending=fetch("/api/favorites",{cache:"no-store"}).then(response=>response.ok?response.json() as Promise<{ids?:string[]}>:{ids:[]}).then((data:{ids?:string[]})=>data.ids||[]).catch(()=>[]);
  return pending;
}
export function favoritesChanged(){pending=null;window.dispatchEvent(new Event("salesorrent:favorites-changed"));}
