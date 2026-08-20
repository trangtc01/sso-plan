CREATE TYPE "PublishMode" AS ENUM ('DRAFT', 'PUBLIC');
CREATE TYPE "FacebookContentType" AS ENUM ('REEL', 'VIDEO_POST');

ALTER TABLE "PublishJob"
ADD COLUMN "publishMode" "PublishMode" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "facebookContentType" "FacebookContentType";
