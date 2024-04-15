import { News, ResponseData } from './type';

const TELEGRAM_BOT_TOKEN = '[TELEGRAM BOT TOKEN]';
const TELEGRAM_CHAT_ID = '[TELEGRAM_CHAT_ID]';
const MYTEAM: keyof typeof KBO_TEAM = 'OB';
const KBO_TEAM = {
  OB: '두산',
  KT: 'KT',
  SK: 'SSG',
  LG: 'LG',
  NC: 'NC',
  HT: 'KIA',
  HH: '한화',
  LT: '롯데',
  WO: '키움',
  SS: '삼성',
} as const;

function app() {
  if (!KBO_TEAM[MYTEAM]) {
    Logger.log('현재 선택한 야구팀이 없습니다. 팀을 선택해주세요.');
    return;
  }

  const today = new Date();
  const hour = today.getHours();
  const minute = today.getMinutes();
  const lastUpdateNewsTime = getLastUpdateNewsTime() || `${formatDate(today)} ${hour}:${minute}`;
  const newsList = fetchBaseballTeamNews(MYTEAM);

  if (newsList) {
    const latestNewsList = newsList.filter(
      (news) => new Date(lastUpdateNewsTime) < new Date(news.datetime)
    );
    if (latestNewsList.length > 0) {
      setLastUpdateNewsTime(latestNewsList[0].datetime);
      const latestNewsListAsc = latestNewsList.reverse();
      notifyNewsList(latestNewsListAsc);
    } else {
      setLastUpdateNewsTime(newsList[0].datetime);
      Logger.log(`${newsList[0].datetime} 이후, 최신 뉴스가 없습니다. `);
    }
  }
}

function getLastUpdateNewsTime() {
  return PropertiesService.getScriptProperties().getProperty('LAST_UPDATE_NEWS_TIME');
}

function setLastUpdateNewsTime(value: string) {
  PropertiesService.getScriptProperties().setProperty('LAST_UPDATE_NEWS_TIME', value);
}

function fetchBaseballTeamNews(team: keyof typeof KBO_TEAM) {
  try {
    const url = `https://sports.news.naver.com/kbaseball/news/list?type=team&team=${team}&isphoto=N`;
    const response = UrlFetchApp.fetch(url, {
      contentType: 'application/json',
    });
    const data = JSON.parse(response.getContentText());
    if (isResponseData(data)) {
      return data.list;
    }
  } catch (error) {
    Logger.log('뉴스 데이터를 가져오지 못했습니다.');
    Logger.log(error);
  }
}

function notifyNewsList(newsList: News[]) {
  for (const news of newsList) {
    const newsLink = `https://sports.news.naver.com/kbaseball/news/read?oid=${news.oid}&aid=${news.aid}`;
    sendMessage(newsLink);
  }
}

function sendMessage(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const params = {
      payload: {
        chat_id: `${TELEGRAM_CHAT_ID}`,
        text: message,
      },
    };
    UrlFetchApp.fetch(url, params);
  } catch (error) {
    Logger.log('텔레그램 메세지를 전송하는데 실패했습니다');
    Logger.log(error);
  }
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}.${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}`;
}

function isResponseData(data: unknown): data is ResponseData {
  if (
    typeof data === 'object' &&
    data !== null &&
    'list' in data &&
    'date' in data &&
    'type' in data &&
    'page' in data &&
    'totalPages' in data
  ) {
    return true;
  } else {
    return false;
  }
}
