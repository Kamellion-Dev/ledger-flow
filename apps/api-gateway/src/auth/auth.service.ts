import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';

export interface AuthPrincipal {
  sub: string;
  email: string;
  role: 'operator' | 'viewer';
}

@Injectable()
export class AuthService {
  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthPrincipal }> {
    if (email !== process.env.DEMO_EMAIL || password !== process.env.DEMO_PASSWORD) {
      throw new UnauthorizedException('Invalid demo credentials');
    }
    const user: AuthPrincipal = { sub: 'demo-operator', email, role: 'operator' };
    const accessToken = await new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(this.secret());
    return { accessToken, user };
  }

  async verify(token: string): Promise<AuthPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.secret());
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        (payload.role !== 'operator' && payload.role !== 'viewer')
      ) {
        throw new Error('Invalid token payload');
      }
      return { sub: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private secret(): Uint8Array {
    const value = process.env.JWT_SECRET;
    if (!value || value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
    return new TextEncoder().encode(value);
  }
}
