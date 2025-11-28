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

const LAST_UPDATE_NEWS_AID = 'LAST_UPDATE_NEWS_AID';
const LAST_UPDATE_NEWS_OID = 'LAST_UPDATE_NEWS_OID';
const LAST_UPDATE_NEWS_TIME = 'LAST_UPDATE_NEWS_TIME';

function app() {
  if (!KBO_TEAM[MYTEAM]) {
    Logger.log('현재 선택한 야구팀이 없습니다. 팀을 선택해주세요.');
    return;
  }

  const lastUpdateNewsTime = getProperty(LAST_UPDATE_NEWS_TIME);
  if (!lastUpdateNewsTime) {
    checkAndInitializeBot();
    return;
  }

  const newsList = fetchBaseballTeamNews(MYTEAM);
  if (!newsList) {
    Logger.log('뉴스 목록을 가져오지 못했습니다.');
    return;
  }

  const latestNewsListAsc = getLatestNewsList(newsList.reverse(), lastUpdateNewsTime);
  if (latestNewsListAsc.length === 0) {
    Logger.log(`${lastUpdateNewsTime} 이후, 최신 뉴스가 없습니다.`);
    return;
  }
  Logger.log(`최신 뉴스: ${latestNewsListAsc.length}개 `);

  let postedCount = 0;
  let latestNews: News | null = null;

  for (const news of latestNewsListAsc) {
    const result = processNews(news);

    if (!result || result.error) break;
    if (result.ok) {
      latestNews = result.data;
      postedCount++;
    }
  }

  Logger.log(`총 ${postedCount}개의 뉴스를 게시했습니다.`);
  if (latestNews) {
    saveLastUpdateNews(latestNews);
  }
}

function processNews(news: News) {
  const { title, officeName, url, oid, aid, totalCount } = news;

  const newsUrl = url ?? createNewsUrl({ officeId: oid, articleId: aid });
  const message = createNewsCardText({
    officeName,
    title,
    totalCount,
    url: newsUrl,
  });

  if (DEBUG_MODE) {
    Logger.log(
      `[${news.officeName.trim()}] ${news.title}\n${news.subContent}\n- 입력: ${
        news.datetime
      }\n- 조회수: ${news.totalCount}`
    );
  } else {
    Logger.log(`[${officeName}] '${title}' 항목 게시중...`);
    try {
      sendMessage(message, newsUrl);
      return { ok: true, data: news, error: false };
    } catch (error) {
      Logger.log(`[${officeName}] '${title}' 항목 게시중 에러가 발생했습니다.`);
      return { ok: false, data: null, error: true };
    }
  }
}

function saveLastUpdateNews(news: News) {
  setProperty(LAST_UPDATE_NEWS_AID, news.aid);
  setProperty(LAST_UPDATE_NEWS_OID, news.oid);
  setProperty(LAST_UPDATE_NEWS_TIME, news.datetime);
}

function checkAndInitializeBot() {
  const hasTrigger = checkTriggerExists('app');
  if (!hasTrigger) {
    Logger.log('네이버 스포츠 뉴스봇의 초기 설정 중입니다.');
    setProperty(
      LAST_UPDATE_NEWS_TIME,
      Utilities.formatDate(new Date(), 'GMT+9', 'yyyy.MM.dd HH:mm')
    );
    createTrigger('app');
  }
}

function createTrigger(fn: string) {
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
}

function checkTriggerExists(triggerName: string) {
  let hasTrigger = false;
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === triggerName) {
      Logger.log(`${triggerName} 트리거가 이미 존재합니다.`);
      hasTrigger = true;
      break;
    }
  }

  return hasTrigger;
}

function getLatestNewsList(newsList: News[], lastUpdateNewsTime: string) {
  const lastUpdateNewsOid = getProperty(LAST_UPDATE_NEWS_OID);
  const lastUpdateNewsAid = getProperty(LAST_UPDATE_NEWS_AID);

  const lastUpdateNewsIndex = newsList.findIndex(
    (news) => news.oid === lastUpdateNewsOid && news.aid === lastUpdateNewsAid
  );
  if (lastUpdateNewsIndex !== -1) {
    return newsList.slice(lastUpdateNewsIndex + 1);
  }
  return newsList.filter((news) => new Date(lastUpdateNewsTime) < new Date(news.datetime));
}

function getProperty(key: string) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setProperty(key: string, value: string) {
  PropertiesService.getScriptProperties().setProperty(key, value);
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
    Logger.log(error);
    throw new Error('뉴스 데이터를 가져오는 도중 에러가 발생했습니다.');
  }
}

function createNewsCardText({
  officeName,
  title,
  totalCount,
  url,
}: {
  officeName: string;
  title: string;
  totalCount: number;
  url: string;
}) {
  return `[${officeName.trim()}] ${title}\n- 조회수: ${totalCount}\n\n${url}`;
}

function createNewsUrl({ officeId, articleId }: { officeId: string; articleId: string }) {
  return `https://m.sports.naver.com/kbaseball/article/${officeId}/${articleId}`;
}

function sendMessage(message: string, link: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      payload: {
        chat_id: `${TELEGRAM_CHAT_ID}`,
        text: message,
        link_preview_options: JSON.stringify({ url: link, prefer_small_media: true }),
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
  }
  return false;
}
