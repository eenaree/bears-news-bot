export type News = {
  oid: string;
  aid: string;
  sourceName: string;
  title: string;
  subContent: string;
  thumbnail: string;
  dateTime: string;
  url: string | null;
  sectionName: string;
  type: string;
  count: number;
};

export type ResponseData = {
  newsList: News[];
  page: number;
  totalPages: number;
};
