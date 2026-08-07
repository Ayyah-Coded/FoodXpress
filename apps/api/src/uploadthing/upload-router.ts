import { Request } from 'express';
import { JwtPayload, UserRole } from '@food-xpress/types';
import { createUploadthing, type FileRouter } from 'uploadthing/express';
import { JwtService } from '@nestjs/jwt';



class UploadThingError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'UploadThingError';
  }
}

type AuthenticatedRequest = Request & { user?: JwtPayload };

const f = createUploadthing();

export const uploadRouter: FileRouter = {
  restaurantImage: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(({ req }) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) throw new UploadThingError('Missing Authorization header');

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer')
        throw new UploadThingError('Invalid Authorization format');

      const token = parts[1];
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new UploadThingError('Server misconfiguration: JWT secret missing');

      try {
        const jwtService = new JwtService({ secret });
        const payload = jwtService.verify<JwtPayload>(token);
        if (!payload || !payload.sub) throw new Error('Invalid payload');

        // require owner role for restaurant image uploads
        if (payload.role !== UserRole.RESTAURANT_OWNER) {
          throw new UploadThingError('Forbidden: owner role required');
        }

        return { uploadedBy: payload.sub };
      } catch (e) {
        throw new UploadThingError('Invalid or expired token');
      }
    })
    .onUploadComplete(({ file, metadata }) => {
      console.log('Upload complete by:', metadata.uploadedBy);
      console.log('File URL:', file.ufsUrl);
      return { url: file.ufsUrl };
    }),

  menuItemImage: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(({ req }) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) throw new UploadThingError('Missing Authorization header');

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer')
        throw new UploadThingError('Invalid Authorization format');

      const token = parts[1];
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new UploadThingError('Server misconfiguration: JWT secret missing');

      try {
        const jwtService = new JwtService({ secret });
        const payload = jwtService.verify<JwtPayload>(token);
        if (!payload || !payload.sub) throw new Error('Invalid payload');

        return { uploadedBy: payload.sub };
      } catch (e) {
        throw new UploadThingError('Invalid or expired token');
      }
    })
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;