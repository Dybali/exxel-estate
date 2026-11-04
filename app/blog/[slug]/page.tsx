import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import Link from '@/components/SafeLink';
import {ArticleDetailView} from '@/components/Editorial';
import {editorialArticles,editorialDate} from '@/lib/editorial';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {pageAlternates,requestLocale} from '@/lib/request-context';
import {shareMetadata} from '@/lib/share-metadata';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params,article=editorialArticles.find(a=>a.slug===slug);return article?{title:article.title+' | estatemarket24 Journal',description:article.excerpt,alternates:await pageAlternates('/blog/'+article.slug),...shareMetadata({title:article.title,description:article.excerpt,path:'/blog/'+article.slug,locale:await requestLocale(),article:{publishedTime:article.date}})}:{title:'Yazı bulunamadı'};}
export default async function Article({params}:{params:Promise<{slug:string}>}){const {slug}=await params,article=editorialArticles.find(a=>a.slug===slug);if(!article)notFound();return <ArticleDetailView article={article}/>;}
