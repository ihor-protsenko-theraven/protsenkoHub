import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH } from './auth.config';
import { AuthService } from './auth.service';
import { LoginDto, MobileRefreshDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto, RegisterInvitedDto } from './dto/invitation.dto';
import { SaveFamilyChildDto } from './dto/family-child.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitations: InvitationService,
  ) {}

  @Get('family')
  @UseGuards(JwtAuthGuard)
  async family(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.invitations.family(user);
    } catch (error) {
      this.clearCookieOnUnauthorized(res, error);
      throw error;
    }
  }

  @Put('family/child')
  @UseGuards(JwtAuthGuard)
  async saveFamilyChild(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveFamilyChildDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.invitations.saveFamilyChild(user, dto);
    } catch (error) {
      this.clearCookieOnUnauthorized(res, error);
      throw error;
    }
  }

  @Post('family/invitations')
  @UseGuards(JwtAuthGuard)
  createInvitation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(user, dto);
  }

  @Delete('family/invitations/:id')
  @UseGuards(JwtAuthGuard)
  revokeInvitation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.revoke(user, id);
  }

  @Get('invitations/:token')
  previewInvitation(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.invitations.accept(user, token);
    this.setCookie(res, result.token);
    return { user: result.user };
  }

  @Post('invitations/:token/register')
  async registerInvited(
    @Param('token') token: string,
    @Body() dto: RegisterInvitedDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.invitations.register(token, dto);
    this.setCookie(res, result.token);
    return { user: result.user };
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setCookie(res, result.token);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setCookie(res, result.token);
    return { user: result.user };
  }

  @Post('mobile/login')
  @HttpCode(200)
  async mobileLogin(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return this.authService.issueMobileSession(result.user);
  }

  @Post('mobile/register')
  async mobileRegister(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return this.authService.issueMobileSession(result.user);
  }

  @Post('mobile/invitations/:token/register')
  async mobileRegisterInvited(
    @Param('token') token: string,
    @Body() dto: RegisterInvitedDto,
  ) {
    const result = await this.invitations.register(token, dto);
    return this.authService.issueMobileSession(result.user);
  }

  @Post('mobile/invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  async mobileAcceptInvitation(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ) {
    const result = await this.invitations.accept(user, token);
    return { user: result.user };
  }

  @Post('mobile/refresh')
  @HttpCode(200)
  mobileRefresh(@Body() dto: MobileRefreshDto) {
    return this.authService.refreshMobileSession(dto.refreshToken);
  }

  @Post('mobile/logout')
  @HttpCode(200)
  async mobileLogout(@Body() dto: MobileRefreshDto) {
    await this.authService.revokeMobileSession(dto.refreshToken);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH.cookieName, { path: AUTH.cookiePath });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let resolvedUser: AuthUser;
    try {
      resolvedUser = await this.authService.me(user);
    } catch (error) {
      res.clearCookie(AUTH.cookieName, { path: AUTH.cookiePath });
      throw error;
    }
    const cookies = req.cookies as Record<string, string> | undefined;
    const upgraded = await this.authService.upgradeWebToken(
      resolvedUser,
      cookies?.[AUTH.cookieName],
    );
    if (upgraded) this.setCookie(res, upgraded);
    return { user: resolvedUser };
  }

  private setCookie(res: Response, token: string): void {
    res.cookie(AUTH.cookieName, token, {
      httpOnly: true,
      sameSite: AUTH.sameSite,
      secure:
        process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      maxAge: AUTH.maxAgeMs,
      path: AUTH.cookiePath,
    });
  }

  private clearCookieOnUnauthorized(
    res: Response | undefined,
    error: unknown,
  ): void {
    if (error instanceof UnauthorizedException) {
      res?.clearCookie(AUTH.cookieName, { path: AUTH.cookiePath });
    }
  }
}
