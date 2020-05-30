#!/usr/bin/env node

'use strict';
const http = require("http");
const https = require("https");
const sortOn = require('sort-on');
const prettyMs = require('pretty-ms');
const humanizeUrl = require('humanize-url');

const zip = section => section.reduce((acc, current) => {
  const {
    label,
    value
  } = current;
  acc[label] = value;
  return acc;
}, {});

function json(overview, statistics, ruleSetResults, opportunities) {
  return {
    overview: zip(overview),
    statistics: zip(statistics),
    ruleResults: zip(ruleSetResults),
    opportunities: zip(opportunities)
  };
}

function overview(url, strategy, scores) {
  return [{
      label: 'URL',
      value: url
    },
    {
      label: 'Strategy',
      value: strategy
    },
    {
      label: 'Performance',
      value: convertToPercentum(scores.categories.performance.score)
    }
  ];
}

const fieldData = stats => {
  const ret = [];

  for (const title in stats) {
    if (Object.prototype.hasOwnProperty.call(stats, title)) {
      ret.push({
        label: title,
        value: prettyMs(stats[title].percentile)
      });
    }
  }

  return sortOn(ret, 'label');
};

const getRules = (rules, group) => rules.filter(rule => rule.group === group);

const labData = lighthouseResult => {
  const {
    audits,
    categories
  } = lighthouseResult;
  const rules = getRules(categories.performance.auditRefs, 'metrics');

  const ret = rules.map(rule => {
    const {
      title,
      displayValue
    } = audits[rule.id];
    return {
      label: title,
      value: displayValue.replace(/\s/g, '')
    };
  });

  return sortOn(ret, 'label');
};

const opportunities = lighthouseResult => {
  const {
    audits,
    categories
  } = lighthouseResult;
  const rules = getRules(categories.performance.auditRefs, 'load-opportunities');

  const opportunityRules = rules.filter(rule => {
    const {
      details
    } = audits[rule.id];
    return details && details.type === 'opportunity' && details.overallSavingsMs > 0;
  });

  const ret = opportunityRules.map(rule => {
    const {
      title,
      details
    } = audits[rule.id];
    return {
      label: title,
      value: prettyMs(details.overallSavingsMs)
    };
  });

  return sortOn(ret, 'label');
};

const convertToPercentum = num => Math.round(num * 100);

function success(response, data, message) {
  response.writeHead(200, {
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify({
    code: 0,
    data,
    message
  }));
}

function error(response, message, data) {
  if (typeof message == 'object') {
    data = message;
    message = message.toString()
  }
  response.writeHead(200, {
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify({
    code: 1,
    message,
    data,
  }));
}

function psi(url, options) {
  return new Promise((resolve, reject) => {
    let api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    const search = new URLSearchParams({
      'url': url,
      'strategy': options.strategy || 'mobile'
    });
    if (options.key) {
      search.set('key', options.key);
    } else {
      search.set('nokey', 'true');
    }

    api = api + '?' + search.toString();

    try {
      const req = https.request(api, function (res) {
        res.setEncoding("utf-8");
        // console.log(res);
        let body = '';
        res.on('data', function (data) {
          body += data;
        });
        res.on('end', function () {
          try {
            const result = JSON.parse(body);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', function (e) {
        console.log(e);
        reject(e);
      });
      req.end();
    } catch (e) {
      console.log(e);
      reject(e);
    }
  })
}

http.createServer(async function (request, response) {
  try {
    let url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/psi') {
      // 处理参数
      console.log(url.searchParams);
      if (!url.searchParams.get('url')) {
        return error(response, 'url不能为空');
      }
      let requestError;
      const strategy = url.searchParams.get('strategy') || 'mobile';
      const result = await psi(url.searchParams.get('url'), {
        'strategy': strategy,
        'key': url.searchParams.get('key') || ''
      }).catch((reason) => {
        requestError = reason;
      });
      if (requestError) {
        return error(response, requestError);
      }

      if (url.searchParams.get('full')) {
        return success(response, result);
      }

      const {
        lighthouseResult,
        loadingExperience,
        id
      } = result;

      const data = json(
        overview(humanizeUrl(id), strategy, lighthouseResult),
        fieldData(loadingExperience.metrics),
        labData(lighthouseResult),
        opportunities(lighthouseResult)
      )

      return success(response, data);
    }

    // 发送 HTTP 头部
    // HTTP 状态值: 200 : OK
    // 内容类型: text/plain
    response.writeHead(200, {
      'Content-Type': 'text/plain'
    });

    // 发送响应数据 "Hello World"
    response.end('Hello World\n');
  } catch (e) {
    console.log(e);
    return error(response, e);
  }
}).listen(8888);

// 终端打印如下信息
console.log('Server running at http://127.0.0.1:8888/');