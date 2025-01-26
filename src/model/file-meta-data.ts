export type FileMetaData = {
  file: {
    name: string;
    size: number;
    createdAt: number;
    modifiedAt: number;
  };
  hash: {
    sha256: string;
  };
  verification: {
    lastVerifiedAt: number;
    lastVerifiedBy: string;
  };
  metaData: {
    approximateModifiedAt: number;
  };
};
