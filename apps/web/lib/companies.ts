export type Company = {
  id: string;
  ownerId?:string;
  avatarUrl?:string|null;
  name: string;
  category: "agency" | "developer";
  listingCount: number;
  saleCount: number;
  rentCount: number;
  sample?: boolean;
  city?: string;
  description?: string;
  listingIds?: string[];
  coverUrl?:string;
  initials?:string;
  project?:{name:string;description:string;features:string[];image:string};
  photoCredit?:{label:string;url:string};
};
