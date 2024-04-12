export type News = {
  oid: string;
  aid: string;
  officeName: string;
  title: string;
  subContent: string;
  thumbnail: string;
  datetime: string;
  url: string | null;
  sectionName: string;
  type: string;
  totalCount: number;
};

export type ResponseData = {
  list: News[];
  date: string;
  type: string;
  page: number;
  totalPages: number;
};
