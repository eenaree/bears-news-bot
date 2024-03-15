import axios from 'axios';
import { News } from './type.ts';

app();

async function app() {
  const newsList = await fetchBaseballTeamNews('OB');
  const prevHour = new Date().getHours() - 1;

  const pastHourNewsList = newsList.filter((news) => {
    const newsPublishedHour = new Date(news.datetime).getHours();
    return prevHour === newsPublishedHour;
  });
  console.log(pastHourNewsList);
}

async function fetchBaseballTeamNews(team: string) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dateString = `${year}${month.toString().padStart(2, '0')}${day
    .toString()
    .padStart(2, '0')}`;

  try {
    const { data } = await axios.get<{ list: News[] }>(
      'https://sports.news.naver.com/kbaseball/news/list',
      {
        params: {
          type: 'team',
          team,
          isphoto: 'N',
          date: dateString,
        },
      }
    );
    return data.list;
  } catch (error) {
    throw new Error(`Failed to fetch ${team} news: ${error}`);
  }
}
