# Visual sources

The homepage hero and the “Satın al” shortcut use a real Antalya villa photo by Ahmet ÇÖTÜR on [Pexels](https://www.pexels.com/photo/modern-luxury-villa-with-infinity-pool-and-scenic-views-32226001/). The hero includes an on-page credit.

The “Kirala” shortcut uses an [Unsplash house photograph](https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3). The “Şirketler” shortcut uses an [Unsplash office-building photograph](https://images.unsplash.com/photo-1486406146926-c627a92ad1ab). Both are cropped into small local WebP thumbnails for the cards.

The shortcut images are decorative and carry empty alt text; the visible card text names each destination.

## Home page slideshow (2026-11-17)

`components/HeroSlides.tsx` cross-fades four licensed photos with a slow zoom; the credit under the hero follows the photo on screen:

1. Antalya villa at sunset: Ahmet ÇÖTÜR, [Pexels](https://www.pexels.com/photo/luxurious-modern-villa-with-infinity-pool-at-sunset-31817157/) (`public/villa-sunset-*.webp`, the LCP image)
2. Stone villa above the sea, Kaş/Antalya: Vlada Karpovich, [Pexels](https://www.pexels.com/photo/villa-with-a-scenic-view-of-the-sea-7902904/) (`public/antalya-mediterranean.webp`)
3. White villa with pool: [Unsplash](https://images.unsplash.com/photo-1613490493576-7fde63acd811) (`public/editorial/`)
4. Modern villa with pool: [Unsplash](https://images.unsplash.com/photo-1600596542815-ffad4c1539a9) (`public/editorial/`)

Only the first photo loads with the page; the others load when the browser is idle. Reduced motion shows the first photo without zoom or rotation.
