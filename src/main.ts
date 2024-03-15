import { env } from 'node:process';
import axios from 'axios';
import 'dotenv/config.js';
import { News } from './type.ts';

const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID;

app();

async function app() {
  const newsList = await fetchBaseballTeamNews('OB');
  const prevHour = new Date().getHours() - 1;

  const pastHourNewsList = newsList.filter((news) => {
    const newsPublishedHour = new Date(news.datetime).getHours();
    return prevHour === newsPublishedHour;
  });

  const pastHourNewsListAsc = pastHourNewsList.reverse();

  notifyNewsList(pastHourNewsListAsc);
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

async function notifyNewsList(newsList: News[]) {
  try {
    for (const news of newsList) {
      const newsLink = `https://sports.news.naver.com/kbaseball/news/read?oid=${news.oid}&aid=${news.aid}`;

      await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        params: {
          chat_id: TELEGRAM_CHAT_ID,
          text: `[${news.officeName}] ${news.title}\n- 조회수: ${news.totalCount}\n\n${newsLink}`,
        },
      });
    }
  } catch (error) {
    throw new Error(`Failed to notify news list: ${error}`);
  }
}
