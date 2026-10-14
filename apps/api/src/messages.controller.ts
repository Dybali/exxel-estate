import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpException, NotFoundException, Post, Query, Req } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, now, requireUser, str } from "./common";
import { PrismaService } from "./prisma.service";

type Conversation = { id:string; listing_id:string; sender_id:string; peer_id:string; last_body:string; last_at:string; peer_name:string; listing_title:string; listing_status:string|null };

@Controller("messages")
export class MessagesController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  @Get() async list(@Query() query: Record<string,string>, @Req() request: AuthRequest) {
    const user = await this.auth.current(request); requireUser(user);
    const listingId = str(query.listingId, 80), peerId = str(query.peerId, 80);
    if (listingId || peerId) {
      if (!listingId || !peerId || peerId === user.id) throw new BadRequestException("Görüşme seçimi geçersiz.");
      const rows = await this.prisma.messages.findMany({ where: { listing_id: listingId, OR: [{sender_id:user.id,recipient_id:peerId},{sender_id:peerId,recipient_id:user.id}] }, orderBy: [{created_at:"desc"},{id:"desc"}], take:100 });
      return { messages: rows.reverse() };
    }
    const rows = await this.prisma.$queryRaw<Conversation[]>(Prisma.sql`
      WITH ranked AS (
        SELECT m.id,m.listing_id,m.sender_id,m.recipient_id,m.body,m.created_at,
          CASE WHEN m.sender_id=${user.id}::uuid THEN m.recipient_id ELSE m.sender_id END AS peer_id,
          ROW_NUMBER() OVER (PARTITION BY m.listing_id,CASE WHEN m.sender_id=${user.id}::uuid THEN m.recipient_id ELSE m.sender_id END ORDER BY m.created_at DESC,m.id DESC) AS position
        FROM messages m WHERE (m.sender_id=${user.id}::uuid OR m.recipient_id=${user.id}::uuid) AND m.recipient_id IS NOT NULL
      )
      SELECT ranked.id,ranked.listing_id,ranked.sender_id,ranked.peer_id,
        ranked.body AS last_body,ranked.created_at AS last_at,
        COALESCE(u.name,'Üye') AS peer_name,COALESCE(l.title,'İlan artık yayında değil') AS listing_title,l.status AS listing_status
      FROM ranked LEFT JOIN users u ON u.id=ranked.peer_id LEFT JOIN listings l ON l.id::text=ranked.listing_id
      WHERE ranked.position=1 ORDER BY ranked.created_at DESC,ranked.id DESC LIMIT 100
    `);
    return { conversations: rows };
  }
  @Post() async send(@Body() data: Record<string,unknown>, @Req() request: AuthRequest) {
    assertOrigin(request);
    const user = await this.auth.current(request); requireUser(user);
    const listingId = str(data.listingId, 80), peerId = str(data.peerId, 80), message = str(data.message, 2000);
    if (message.length < 2) throw new BadRequestException("Mesaj en az 2 karakter olmalı.");
    if (!/^[a-f0-9-]{36}$/i.test(listingId)) throw new NotFoundException("İlan bulunamadı.");
    const listing = await this.prisma.listings.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("İlan bulunamadı.");
    let recipientId: string;
    if (listing.owner_id === user.id) {
      if (!peerId || peerId === user.id) throw new BadRequestException("Görüşmeyi seçin.");
      const first = await this.prisma.messages.findFirst({ where: { listing_id: listingId, sender_id: peerId, recipient_id: user.id } });
      if (!first) throw new ForbiddenException("Bu görüşmeye yanıt veremezsiniz.");
      recipientId = peerId;
    } else {
      if (peerId && peerId !== listing.owner_id) throw new ForbiddenException("Görüşme seçimi geçersiz.");
      const existing = await this.prisma.messages.findFirst({ where: { listing_id: listingId, OR: [{sender_id:user.id,recipient_id:listing.owner_id},{sender_id:listing.owner_id,recipient_id:user.id}] } });
      if (listing.status !== "published" && !existing) throw new ForbiddenException("İlan yayında değil.");
      recipientId = listing.owner_id;
    }
    const recent = await this.prisma.messages.count({ where: { sender_id: user.id, created_at: { gt: new Date(Date.now() - 60_000).toISOString() } } });
    if (recent >= 10) throw new HttpException("Bir dakika sonra tekrar deneyin.", 429);
    const id = randomUUID(), createdAt = now();
    await this.prisma.messages.create({ data: { id, listing_id: listingId, sender_id: user.id, recipient_id: recipientId, body: message, created_at: createdAt } });
    return { id, listingId, peerId: recipientId, createdAt };
  }
}
