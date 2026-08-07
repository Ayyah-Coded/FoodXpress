import { Request } from 'express';
import { JwtPayload } from '@food-xpress/types';
import { createUploadthing, type FileRouter } from 'uploadthing/express';



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
      const authReq = req as AuthenticatedRequest;
      return { uploadedBy: authReq.user?.sub ?? 'unknown' };
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
      const authReq = req as AuthenticatedRequest;
      return { uploadedBy: authReq.user?.sub ?? 'unknown' };
    })
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;