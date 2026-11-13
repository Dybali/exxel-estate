'use client';
import Link from './SafeLink';import {useLocale} from '@/lib/i18n';import {adminGroup,adminHref} from '@/lib/admin-nav';
// The screens of the current Yönetim group as tabs (lib/admin-nav.ts); nothing for one-screen groups.
export function AdminGroupTabs({view}:{view:string}){
 const {t}=useLocale(),group=adminGroup(view);
 if(group.views.length<2)return null;
 return <nav className="admin-group-tabs" aria-label={t(group.label)}>{group.views.map(item=><Link key={item.id} href={adminHref(item)} aria-current={item.id===view?'page':undefined} className={item.id===view?'active':''}>{t(item.label)}</Link>)}</nav>;
}
