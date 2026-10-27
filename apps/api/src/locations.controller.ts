import { Controller, Get, Query } from "@nestjs/common";
import { str } from "./common";
import districtsData from "./data/districts.json";
import neighborhoodsData from "./data/neighborhoods.json";

const districts = districtsData as Record<string, string[]>;
const neighborhoods = neighborhoodsData as Record<string, Record<string, {id:number;name:string;postalCode:string;label:string}[]>>;

@Controller("locations")
export class LocationsController {
  @Get() get(@Query() query: Record<string,string>) {
    const city = str(query.city, 70), district = str(query.district, 70);
    return { neighborhoods: districts[city]?.includes(district) ? neighborhoods[city]?.[district] || [] : [] };
  }
}
