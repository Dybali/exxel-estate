import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import Link from '@/components/SafeLink';
import {ArticleDetailView} from '@/components/Editorial';
import {editorialArticles,editorialDate,editorialFields,localizedArticle,type EditorialArticle} from '@/lib/editorial';
import {serviceDB} from '@/lib/server';
import {storedTranslation} from '@/lib/translation-stored';
// Saved translation of an article for the page language (articles are written in Turkish); never a provider call.
const storedArticle=(article:EditorialArticle,locale:string)=>locale==='tr'?null:storedTranslation(serviceDB() as never,{kind:'blog',id:article.slug,fields:editorialFields(article)},locale);
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {pageAlternates,requestLocale} from '@/lib/request-context';
import {shareMetadata} from '@/lib/share-metadata';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params,found=editorialArticles.find(a=>a.slug===slug),locale=await requestLocale(),stored=found?await storedArticle(found,locale):null,article=found&&stored?localizedArticle(found,stored.fields):found;return article?{title:article.title+' | estatemarket24 Journal',description:article.excerpt,alternates:await pageAlternates('/blog/'+article.slug),...shareMetadata({title:article.title,description:article.excerpt,path:'/blog/'+article.slug,locale,article:{publishedTime:article.date}})}:{title:'Yazı bulunamadı'};}
export default async function Article({params}:{params:Promise<{slug:string}>}){const {slug}=await params,article=editorialArticles.find(a=>a.slug===slug);if(!article)notFound();return <ArticleDetailView article={article} initial={await storedArticle(article,await requestLocale())}/>;}
