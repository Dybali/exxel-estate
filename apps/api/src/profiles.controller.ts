import {Controller,Get,Header,NotFoundException,Param,Query} from '@nestjs/common';
import {PrismaService} from './prisma.service';
import {listingView} from './listings.controller';
@Controller('profiles')
export class ProfilesController{
 constructor(private readonly prisma:PrismaService){}
 @Get(':id') @Header('Cache-Control','no-store') async detail(@Param('id') id:string,@Query('page') pageValue?:string){
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw new NotFoundException('Profil bulunamadı.');
 const seller=await this.prisma.users.findUnique({where:{id},include:{seller_profile:true,agencies:true}});
 if(!seller||!['individual','agent','admin'].includes(seller.role))throw new NotFoundException('Profil bulunamadı.');
 const page=Number.isInteger(Number(pageValue||1))&&Number(pageValue||1)>0?Math.min(Number(pageValue||1),1000):1,pageSize=12;
 const scope={owner_id:id,status:'published'};const [rows,listingCount,saleCount,rentCount]=await Promise.all([this.prisma.listings.findMany({where:scope,include:{users_listings_owner_idTousers:{select:{name:true}}},orderBy:[{created_at:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize}),this.prisma.listings.count({where:scope}),this.prisma.listings.count({where:{...scope,purpose:'satilik'}}),this.prisma.listings.count({where:{...scope,purpose:'kiralik'}})]);
 const agency=seller.agencies;return {profile:{id:seller.id,name:seller.name,company:seller.role==='agent'?(agency?.name||seller.company):null,role:seller.role,category:agency?.category,agentApproved:seller.role==='agent'&&seller.agent_status==='approved'&&agency?.status==='approved',avatarUrl:seller.avatar_url,bio:seller.seller_profile?.bio||'',memberSince:seller.created_at,listingCount,saleCount,rentCount},listings:rows.map(listingView),page,pageSize};
 }
}
