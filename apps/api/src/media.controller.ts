import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Post, Req, Res, ServiceUnavailableException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomUUID } from "node:crypto";
import type { Response } from "express";
import {panoramaDimensions} from './shared/panoramas';
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, requireUser } from "./common";
import { PrismaService } from "./prisma.service";

const mimeTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type ImageMime = keyof typeof mimeTypes;
const maxImageBytes = 8_000_000;
const validSignature = (type: string, bytes: Uint8Array) => type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  : type === "image/png" ? [137,80,78,71,13,10,26,10].every((byte,index) => bytes[index] === byte)
  : type === "image/webp" ? Buffer.from(bytes.subarray(0,4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8,12)).toString() === "WEBP" : false;

@Injectable()
export class MediaService {
  private client?: S3Client;
  private bucket = process.env.R2_BUCKET || "";
  private s3() {
    if (!this.client) {
      const account = process.env.R2_ACCOUNT_ID, key = process.env.R2_ACCESS_KEY_ID, secret = process.env.R2_SECRET_ACCESS_KEY;
      if (!account || !key || !secret || !this.bucket) throw new ServiceUnavailableException("R2 yapılandırması eksik.");
      this.client = new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: key, secretAccessKey: secret }, forcePathStyle: true });
    }
    return this.client;
  }
  async head(key: string) {
    try { const item = await this.s3().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!item.ContentLength || item.ContentLength > maxImageBytes || !item.ContentType || !(item.ContentType in mimeTypes)) return null;
      const object = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: "bytes=0-11" }));
      const bytes = await object.Body?.transformToByteArray();
      if (!bytes || !validSignature(item.ContentType, bytes)) return null;
      return { size: item.ContentLength, contentType: item.ContentType, checksum: item.Metadata?.sha256 || null, bucket: this.bucket };
    } catch { return null; }
  }
  async put(key: string, data: Buffer, type: ImageMime) {
    const checksum = createHash("sha256").update(data).digest("hex");
    await this.s3().send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: type, Metadata: { sha256: checksum } }));
  }
  async presign(key: string, type: ImageMime) {
    return getSignedUrl(this.s3(), new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: type }), { expiresIn: 300 });
  }
  async get(key: string) { return this.s3().send(new GetObjectCommand({ Bucket: this.bucket, Key: key })); }
}

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService, private readonly auth: AuthService, private readonly prisma: PrismaService) {}
  private async seller(request: AuthRequest) {
    const user = await this.auth.current(request); requireUser(user);
    if (!["individual", "agent", "admin"].includes(user.role)) throw new ForbiddenException("İlan veren hesabı gerekli.");
    if (user.role === "agent" && user.agent_status !== "approved" && !this.auth.isAdmin(user)) throw new ForbiddenException("Emlakçı hesabı onay bekliyor.");
    return user;
  }
  @Post("presign") async presign(@Body() data: Record<string, unknown>, @Req() request: AuthRequest) {
    assertOrigin(request);
    const user = await this.seller(request);
    const type = data.contentType;
    const size = Number(data.size);
    if (typeof type !== "string" || !(type in mimeTypes) || !Number.isSafeInteger(size) || size < 1 || size > maxImageBytes) throw new BadRequestException("JPG, PNG veya WEBP; en fazla 8 MB.");
    const key = `listings/${user.id}/${randomUUID()}.${mimeTypes[type as ImageMime]}`;
    return { key, uploadUrl: await this.media.presign(key, type as ImageMime), url: `/api/media/${key}`, expiresIn: 300 };
  }
  @Post("complete") async complete(@Body() data: Record<string, unknown>, @Req() request: AuthRequest) {
    assertOrigin(request);
    const user = await this.seller(request);
    const key = typeof data.key === "string" ? data.key : "";
    if (!/^listings\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key) || !key.startsWith(`listings/${user.id}/`)) throw new ForbiddenException("Dosya anahtarı geçersiz.");
    if (!(await this.media.head(key))) throw new BadRequestException("Yükleme doğrulanamadı.");
    return { url: `/api/media/${key}` };
  }
  @Post() @UseInterceptors(FileInterceptor("file", { limits: { fileSize: maxImageBytes } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() request: AuthRequest) {
    assertOrigin(request);
    const user = await this.seller(request);
    if (!file || !(file.mimetype in mimeTypes) || !file.buffer?.length || file.buffer.length > maxImageBytes || !validSignature(file.mimetype, file.buffer)) throw new BadRequestException("Fotoğraf biçimi geçersiz.");
    if(request.query.purpose==='panorama'){try{if(file.mimetype!=='image/jpeg')throw Error('360° fotoğraf JPG biçiminde olmalıdır.');panoramaDimensions(file.buffer);}catch(cause){throw new BadRequestException((cause as Error).message);}}
    const key = `listings/${user.id}/${randomUUID()}.${mimeTypes[file.mimetype as ImageMime]}`;
    await this.media.put(key, file.buffer, file.mimetype as ImageMime);
    return { url: `/api/media/${key}` };
  }
  @Get("listings/:owner/:file") async image(@Param("owner") owner: string, @Param("file") file: string, @Req() request: AuthRequest, @Res() response: Response) {
    if (!/^[a-f0-9-]{36}$/i.test(owner) || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(file)) throw new NotFoundException();
    const key = `listings/${owner}/${file}`;
    const image = await this.prisma.property_images.findUnique({ where: { object_key: key }, include: { listings: true } });
    const profile=await this.prisma.users.findFirst({where:{id:owner,avatar_url:'/api/media/'+key},select:{id:true}});
    if (image?.listings.status !== "published"&&!profile) {
      const user = await this.auth.current(request);
      if ((!user || user.id !== owner && !this.auth.isAdmin(user)) || image && image.listings.owner_id !== user.id && !this.auth.isAdmin(user)) throw new NotFoundException();
    }
    const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (publicBase && image?.listings.status === "published") return response.redirect(302, `${publicBase}/${key}`);
    try {
      const object = await this.media.get(key);
      response.setHeader("Content-Type", object.ContentType || "application/octet-stream");
      response.setHeader("Cache-Control", (image?.listings.status === "published"||profile) ? "public, max-age=86400, s-maxage=604800" : "private, no-store");
      const bytes = await object.Body?.transformToByteArray();
      if (!bytes) throw new Error("Empty object");
      return response.end(Buffer.from(bytes));
    } catch { throw new NotFoundException(); }
  }
}
