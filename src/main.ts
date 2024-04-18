import { News, ResponseData } from './type';

const DEBUG_MODE = false;
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

  const lastUpdateNewsTime = getLastUpdateNewsTime();
  const newsList = fetchBaseballTeamNews(MYTEAM);

  if (!lastUpdateNewsTime) {
    Logger.log('네이버 스포츠 뉴스봇의 초기 설정 중입니다.');
    setLastUpdateNewsTime(Utilities.formatDate(new Date(), 'GMT+9', 'yyyy.MM.dd HH:mm'));
    ScriptApp.newTrigger('app').timeBased().everyMinutes(15).create();
    return;
  }

  if (newsList) {
    const latestNewsListAsc = getLatestNewsList(newsList, lastUpdateNewsTime).reverse();
    if (latestNewsListAsc.length > 0) {
      Logger.log(`최신 뉴스: ${latestNewsListAsc.length}개 `);

      if (DEBUG_MODE) {
        latestNewsListAsc.forEach((news) => {
          Logger.log(
            `[${news.officeName}] ${news.title}\n${news.subContent}\n- 입력: ${news.datetime}\n- 조회수: ${news.totalCount}`
          );
        });
      } else {
        notifyNewsList(latestNewsListAsc);
        Logger.log('최신 뉴스 항목을 모두 전달했습니다.');
      }
    } else {
      Logger.log(`${lastUpdateNewsTime} 이후, 최신 뉴스가 없습니다. `);
    }
  }
}

function getLatestNewsList(newsList: News[], lastUpdateNewsTime: string) {
  return newsList.filter((news) => new Date(lastUpdateNewsTime) < new Date(news.datetime));
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
    const message = `[${news.officeName}] ${news.title}\n- 조회수: ${news.totalCount}\n\n${newsLink}`;
    Logger.log(`'${news.title}' 항목 게시중...`);
    sendMessage(message);
    setLastUpdateNewsTime(news.datetime);
  }
}

function sendMessage(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      payload: {
        chat_id: `${TELEGRAM_CHAT_ID}`,
        text: message,
      },
    };
    UrlFetchApp.fetch(url, params);
  } catch (error) {
    Logger.log(error);
    throw new Error('텔레그램 메세지를 전송하는데 실패했습니다.');
  }
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
