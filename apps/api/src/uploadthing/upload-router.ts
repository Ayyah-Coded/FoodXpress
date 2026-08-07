import { JwtPayload, UserRole } from '@food-xpress/types';
import { createUploadthing, type FileRouter } from 'uploadthing/express';
import { UploadThingError } from 'uploadthing/server';
import { JwtService } from '@nestjs/jwt';

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
      if (!authHeader) {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Missing Authorization header',
        });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Invalid Authorization format',
        });
      }

      const token = parts[1];
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new UploadThingError({
          code: 'INVALID_SERVER_CONFIG',
          message: 'Upload service is unavailable',
        });
      }

      try {
        const jwtService = new JwtService({ secret });
        const payload = jwtService.verify<JwtPayload>(token);
        if (!payload || !payload.sub) throw new Error('Invalid payload');

        // require owner role for restaurant image uploads
        if (payload.role !== UserRole.RESTAURANT_OWNER) {
          throw new UploadThingError({
            code: 'FORBIDDEN',
            message: 'Forbidden: owner role required',
          });
        }

        return { uploadedBy: payload.sub };
      } catch (error) {
        if (error instanceof UploadThingError) {
          throw error;
        }

        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Invalid or expired token',
        });
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
      if (!authHeader) {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Missing Authorization header',
        });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Invalid Authorization format',
        });
      }

      const token = parts[1];
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new UploadThingError({
          code: 'INVALID_SERVER_CONFIG',
          message: 'Upload service is unavailable',
        });
      }

      try {
        const jwtService = new JwtService({ secret });
        const payload = jwtService.verify<JwtPayload>(token);
        if (!payload || !payload.sub) throw new Error('Invalid payload');

        return { uploadedBy: payload.sub };
      } catch {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Invalid or expired token',
        });
      }
    })
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;