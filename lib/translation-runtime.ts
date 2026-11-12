import {env} from './runtime';
import type {TranslationSettings} from './translation';
export const translationSettings=()=>env as unknown as TranslationSettings;
// Listings are no longer translated into every language when they are published or edited (owner's decision
// 2026-11-12, to cut cost): a language is translated the first time a visitor opens the listing in it
// (POST /api/translations), or by an administrator in Yönetim › Çeviriler.
