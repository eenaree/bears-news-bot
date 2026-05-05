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
  const selectedTeam = MYTEAM;
  if (!KBO_TEAM[selectedTeam]) {
    Logger.log('현재 선택한 야구팀이 없습니다. 팀을 선택해주세요.');
    return;
  }

  const lastProcessedNewsTime = getProperty(LAST_UPDATE_NEWS_TIME);
  const lastProcessedNewsOid = getProperty(LAST_UPDATE_NEWS_OID);
  const lastProcessedNewsAid = getProperty(LAST_UPDATE_NEWS_AID);
  if (!(lastProcessedNewsTime && lastProcessedNewsOid && lastProcessedNewsAid)) {
    checkAndInitializeBot();
    return;
  }

  const fetchedTeamNewsList = fetchBaseballTeamNews(MYTEAM);
  if (!fetchedTeamNewsList) {
    Logger.log('뉴스 목록을 가져오지 못했습니다.');
    return;
  }

  const lastProcessedNewsCursor = {
    oid: lastProcessedNewsOid,
    aid: lastProcessedNewsAid,
    datetime: lastProcessedNewsTime,
  };
  const unprocessedTeamNewsAsc = getLatestNewsList(
    fetchedTeamNewsList.reverse(),
    lastProcessedNewsCursor
  );
  if (unprocessedTeamNewsAsc.length === 0) {
    Logger.log(`${lastProcessedNewsTime} 이후, 최신 뉴스가 없습니다.`);
    return;
  }
  Logger.log(`최신 뉴스: ${unprocessedTeamNewsAsc.length}개 `);

  let postedCount = 0;
  let lastProcessedNews: News | null = null;

  for (const news of unprocessedTeamNewsAsc) {
    // 종합 기사 제외
    if (news.title.includes('(종합)')) {
      Logger.log(`[${news.officeName}] '${news.title}' 항목은 종합 기사이므로 건너뜁니다.`);
      lastProcessedNews = news;
      continue;
    }
    const result = processNews(news);

    if (!result || result.error) break;
    if (result.ok) {
      lastProcessedNews = result.data;
      postedCount++;
    }
  }

  Logger.log(`총 ${postedCount}개의 뉴스를 게시했습니다.`);
  if (lastProcessedNews) {
    saveLastUpdateNews(lastProcessedNews);
  }
}

function processNews(news: News) {
  const { title, officeName: _officeName, url, oid, aid, totalCount, subContent, datetime } = news;
  const officeName = _officeName.trim();
  const newsUrl = url ?? createNewsUrl({ officeId: oid, articleId: aid });
  const message = createNewsCardText({
    officeName,
    title,
    totalCount,
    url: newsUrl,
  });

  if (DEBUG_MODE) {
    Logger.log(
      `[${officeName}] ${title}\n${subContent}\n- 입력: ${datetime}\n- 조회수: ${totalCount}`
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
    const fetchedTeamNewsList = fetchBaseballTeamNews(MYTEAM);
    if (fetchedTeamNewsList && fetchedTeamNewsList.length > 0) {
      saveLastUpdateNews(fetchedTeamNewsList[0]);
      createTrigger('app');
    } else {
      Logger.log('초기화에 필요한 뉴스 데이터를 가져오지 못했습니다.');
    }
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

function getLatestNewsList(
  newsList: News[],
  lastUpdateNews: { oid: string; aid: string; datetime: string }
) {
  const lastUpdateNewsIndex = newsList.findIndex(
    (news) => news.oid === lastUpdateNews.oid && news.aid === lastUpdateNews.aid
  );
  if (lastUpdateNewsIndex !== -1) {
    return newsList.slice(lastUpdateNewsIndex + 1);
  }
  return newsList.filter((news) => new Date(lastUpdateNews.datetime) < new Date(news.datetime));
}

function getProperty(key: string) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setProperty(key: string, value: string) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function fetchBaseballTeamNews(team: keyof typeof KBO_TEAM) {
  try {
    const url = `https://sports.news.naver.com/kbo/news/list?type=latest&team=${team}&isphoto=N`;
    const response = UrlFetchApp.fetch(url, {
      contentType: 'application/json',
    });
    const data = JSON.parse(response.getContentText());
    if (isResponseData(data)) {
      return data.list;
    }
  } catch (error) {
    throw new Error(`뉴스 데이터를 가져오는 도중 에러가 발생했습니다.\n${error}`);
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
  return `[${officeName}] <a href="${url}"><b>${title}</b></a>`;
}

function createNewsUrl({ officeId, articleId }: { officeId: string; articleId: string }) {
  return `https://m.sports.naver.com/kbaseball/article/${officeId}/${articleId}`;
}

function sendMessage(message: string, link: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: {
      chat_id: `${TELEGRAM_CHAT_ID}`,
      text: message,
      parse_mode: 'HTML',
      link_preview_options: JSON.stringify({ url: link, prefer_small_media: true }),
    },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, params);
  const responseCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());
  // 200번대(성공) 혹은 504(타임아웃이지만 실제론 보내졌을 가능성 큼)인 경우 체크
  if (responseCode >= 200 && responseCode < 300) {
    return response;
  } else if (responseCode === 502 || responseCode === 504) {
    console.warn(
      `Gateway Timeout 발생 (Code: ${responseCode}). 일단 성공으로 처리하고 넘어갑니다.`
    );
    return response;
  } else if (!result.ok) {
    throw new Error(`응답 코드: ${responseCode}, 텔레그램 메세지 전송 실패: ${result}`);
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
