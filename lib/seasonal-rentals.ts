// /sezonluk-kiralik: holiday destinations for seasonal and daily rentals (listing purpose "gunluk").
// Place names are the official province/district names used by listings (lib/turkey-locations.ts).
export type SeasonDestination = { key: string; city: string; district?: string; label: string; note: string };
export const SEASON_DESTINATIONS: SeasonDestination[] = [
  { key: "bodrum", city: "Muğla", district: "Bodrum", label: "Bodrum", note: "Koylar, marinalar ve villalar" },
  { key: "fethiye", city: "Muğla", district: "Fethiye", label: "Fethiye", note: "Ölüdeniz, Kayaköy ve Göcek" },
  { key: "marmaris", city: "Muğla", district: "Marmaris", label: "Marmaris", note: "Sahil ve yat turizmi" },
  { key: "alanya", city: "Antalya", district: "Alanya", label: "Alanya", note: "Uzun sahil, güneşli kış" },
  { key: "kas", city: "Antalya", district: "Kaş", label: "Kaş", note: "Sakin koylar ve dalış" },
  { key: "antalya", city: "Antalya", label: "Antalya", note: "Bütün ilçeler" },
  { key: "cesme", city: "İzmir", district: "Çeşme", label: "Çeşme", note: "Alaçatı ve rüzgâr sörfü" },
  { key: "kusadasi", city: "Aydın", district: "Kuşadası", label: "Kuşadası", note: "Efes'e yakın sahil" },
  { key: "didim", city: "Aydın", district: "Didim", label: "Didim", note: "Aile tatili" },
  { key: "ayvalik", city: "Balıkesir", district: "Ayvalık", label: "Ayvalık", note: "Cunda ve zeytinlikler" },
  { key: "istanbul", city: "İstanbul", label: "İstanbul", note: "Şehir tatili ve iş seyahati" },
  { key: "kapadokya", city: "Nevşehir", label: "Kapadokya", note: "Taş evler ve balon turları" },
];
export const seasonHref = (destination: SeasonDestination) => {
  const params = new URLSearchParams({ purpose: "gunluk", city: destination.city });
  if (destination.district) params.set("district", destination.district);
  return `/ilanlar?${params}`;
};
