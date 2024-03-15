import { env } from 'node:process';
import axios from 'axios';
import 'dotenv/config.js';
import { News } from './type.ts';

const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID;

app();

async function app() {
  let newsList: News[] = [];
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const hour = today.getHours();

  // 자정에 실행되는 경우
  if (hour === 0) {
    newsList = await fetchBaseballTeamNewsByDate('OB', formatDate(yesterday));
  } else {
    newsList = await fetchBaseballTeamNewsByDate('OB', formatDate(today));
  }

  const pastHourNewsList = newsList.filter((news) => {
    const prevHour = hour === 0 ? 23 : hour - 1;
    const newsPublishedHour = new Date(news.datetime).getHours();
    return prevHour === newsPublishedHour;
  });

  const pastHourNewsListAsc = pastHourNewsList.reverse();

  notifyNewsList(pastHourNewsListAsc);
}

async function fetchBaseballTeamNewsByDate(team: string, date: string) {
  try {
    const { data } = await axios.get<{ list: News[] }>(
      'https://sports.news.naver.com/kbaseball/news/list',
      {
        params: {
          type: 'team',
          team,
          isphoto: 'N',
          date,
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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
}
