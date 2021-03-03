/*
软件名称:云扫码 微信扫描二维码打开
更新时间：2021-02-28 @肥皂
脚本说明：云扫码自动阅读
脚本为自动完成云扫码的阅读任务
每日收益1元左右，可多号撸。提现秒到
类似番茄看看，番茄看看黑了就跑云扫码，云扫码黑了就跑番茄看看
哈哈哈啊哈哈哈哈

任务打开二维码地址 https://raw.githubusercontent.com/age174/-/main/3B7C4F94-B961-4690-8DF7-B27998789124.png
微信扫描打开，保存临时码，再去扫码获取数据



本脚本以学习为主！
首次运行脚本，会提示获取数据
去云扫码首页即可获取所需数据

TG电报群: https://t.me/hahaha802


boxjs地址 :  

https://raw.githubusercontent.com/age174/-/main/feizao.box.json


云扫码
圈X配置如下，其他软件自行测试，定时可以多设置几次，没任务会停止运行的
[task_local]
#云扫码
15 12,14,16,20,22 * * * https://raw.githubusercontent.com/age174/-/main/ysm.js, tag=云扫码, img-url=https://s3.ax1x.com/2021/02/28/6CRWb8.jpg, enabled=true


[rewrite_local]
#云扫码
^http://erd.+?/yunonline/v\d/redirect/ url script-request-header https://raw.githubusercontent.com/age174/-/main/ysm.js



#loon
^http://erd.+?/yunonline/v\d/redirect/ script-path=https://raw.githubusercontent.com/age174/-/main/ysm.js, requires-body=true, timeout=10, tag=云扫码



#surge

云扫码 = type=http-request,pattern=^http://erd.+?/yunonline/v\d/redirect/,requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/age174/-/main/ysm.js,script-update-interval=0




[MITM]
hostname = .*.top


*/

const $ = new Env('云扫码')
let ysm = $.getjson('ysm', [])
let ysmBanfirstTask = $.getval('ysmBanfirstTask') || 'false' // 禁止脚本执行首个任务，避免每日脚本跑首次任务导致微信限制
let ysmtxAmt = ($.getval('ysmtxAmt') || '0') - 0  // 此处修改提现金额，0.3元等于3000币，默认不提现
ysmtxAmt = ysmtxAmt > 3000 ? (parseInt(ysmtxAmt / 1000) * 1000) : ysmtxAmt > 0 ? 3000 : 0
let concurrency = ($.getval('ysmConcurrency') || '1') - 0 // 并发执行任务的账号数，默单账号循环执行
concurrency = concurrency < 1 ? 1 : concurrency

const moveData = 0 // 是否迁移旧数据，0-不迁移、1-迁移

const baseHeaders = {
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Encoding": "gzip, deflate",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Connection": "keep-alive",
  "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
  "X-Requested-With": "XMLHttpRequest"
}

!(async () => {
  if (typeof $request !== "undefined") {
    await ysmck()
  } else if (moveData) {
    await ysmckMove()
  } else {
    // 获取分组执行账号数据
    let execAcList = getExecAcList()
    let msgInfo = []
    for (let arr of execAcList) {
      let allAc = arr.map(ac => ac.no).join(', ')
      $.log(`\n=======================================\n开始【${$.name}账号：${allAc}】`)
      let rtList = await Promise.all(arr.map((ac, i) => execTask(ac, i)))
      msgInfo.push(rtList.map(ac => `【账号${ac.no}】\n当前余额：${ac.last_gold}币\n今日奖励：${ac.day_gold}\n已阅读数：${ac.day_read}\n待阅读数：${ac.remain_read}${ac.extMsg?'\n\t'+ac.extMsg:''}`).join('\n\n'))
    }
    if (msgInfo.length <= 0) {
      msgInfo.push(`暂无账号数据，请重新扫码进入云扫码首页抓取数据或通过boxjs迁移之前抓取的账号数据`)
    }
    // $.log('\n======== [脚本运行完毕,打印日志结果] ========\n' + msgInfo.join('\n\n'))
    $.msg($.name, '', msgInfo.join('\n\n'))
  }
})()
.catch((e) => $.logErr(e))
  .finally(() => $.done())

function execTask(ac, i) {
  return new Promise(async resolve => {
    try {
      await $.wait(i * 50)
      await ysm4(ac)
      if (ac.remain_read && !(!ac.day_read && ysmBanfirstTask == 'true')) {
        await $.wait((i + 1) * 600)
        let flag = 0
        let count = 1
        let allowErrorCount = 3
        do {
          flag = await ysm1(ac, count++)
          if (flag < 0) {
            allowErrorCount += flag - 0
          }
        } while (flag && allowErrorCount > 0)
      } else {
        $.log(`账号${ac.no} 今日已阅读${ac.day_read}次，今日待阅读${ac.remain_read}次，跳过阅读`)
      }
      if (ac.txbody && ysmtxAmt >= 3000 && ac.last_gold >= ysmtxAmt) {
        ac.extMsg = await ysmdh(ac, ysmtxAmt)
      }
    } catch (e) {
      $.logErr(`账号${ac.no} 循环执行任务出现异常: ${e}`)
    } finally {
      resolve(ac)
    }
  })
}

function getExecAcList() {
  let acList = ysm.filter(o => o.openid).map((o, i) => {
    let data = o.domain.match(/^(https?:\/\/(.+?))\//)
    let acHeader = {
      "Origin": data[1],
      "Host": data[2],
      "User-Agent": o.ua,
      "Referer": `${o.domain}redirect/${o.secret}?openid=${o.openid}&redirect_flag=read`
    }
    return {
      no: i + 1,
      last_gold: 0,
      day_gold: 0,
      remain_read: 0,
      day_read: 0,
      openid: o.openid,
      domain: o.domain,
      headers: {
        ...baseHeaders,
        ...acHeader
      },
      body: `secret=${o.secret}&type=read`,
      txbody: o.txbody
    }
  })
  let execAcList = []
  let slot = acList.length % concurrency == 0 ? acList.length / concurrency : parseInt(acList.length / concurrency) + 1
  acList.forEach((o, i) => {
    let idx = i % slot
    if (execAcList[idx]) {
      execAcList[idx].push(o)
    } else {
      execAcList[idx] = [o]
    }
  })
  $.log(`云扫码当前设置的提现金额为: ${ysmtxAmt / 10000} 元`, `----------- 共${acList.length}个账号分${execAcList.length}组去执行 -----------`)
  return execAcList
}

//云扫码数据获取
async function ysmck() {
  const url = $request.url
  let newAc = ''
  if (url.match(/https?:\/\/.+\/yunonline\/v\d\/redirect\/(?!undefined)/)) {
    let data = url.match(/^.+?\?openid=([^&]*)(&|$)/)
    let openid = data && data[1]
    if (openid) {
      let no = ysm.length
      newAc = await updateAndGetCk(no + 1, openid, $request.headers, url)
      if (newAc) {
        let status = 1
        for (let i = 0, len = no; i < len; i++) {
          let ac = ysm[i] || {}
          if (ac.openid) {
            if (ac.openid == newAc.openid) {
              no = i
              status = 0
              break
            }
          } else if (no == len) {
            no = i
          }
        }
        ysm[no] = newAc
        $.setdata(JSON.stringify(ysm, null, 2), 'ysm')
        $.msg($.name, "", `云扫码[账号${no+1}] ${status?'新增':'更新'}数据成功！`)
      }
    }
  }
  if (!newAc) {
    $.log($.name, `无法从请求中获取到用户账号数据，跳过处理`)
  }
}

function updateAndGetCk(no, openid, headers, referer) {
  return new Promise(resolve => {
    let opts = {
      url: referer
    }
    $.get(opts, async (err, resp, html) => {
      let rtAc = ''
      try {
        if (err) {
          $.logErr(`❌ 账号${no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          let domain = (html.match(/domain="(https?:\/\/.+?)"/) || ['', ''])[1]
          let secret = (html.match(/secret="(.+)";/) || ['', ''])[1]
          let txbody = (html.match(/https?:.+?\/exchange\?(openid=.+?&request_id=.+?)(&|")/) || ['', ''])[1]
          let ua = headers['User-Agent'] || headers['user-agent']
          if (txbody) {
            var Android = String(ua.match(/android/i)).toLowerCase() == "android"
            var iOS = String(ua.match(/iphone/i)).toLowerCase() == "iphone" || String(ua.match(/ipad/i)).toLowerCase() == "ipad"
            txbody += `&ua=${iOS ? 1 : Android ? 2 : 0}`
          }
          if (domain && ua && secret) {
            rtAc = {openid, domain, ua, secret, txbody}
          }
        }
      } catch (e) {
        $.logErr(`======== 账号 ${no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve(rtAc)
      }
    })
  })
}

async function ysmckMove() {
  let ysmArr = []
  let ysmcount = ($.getval('ysmcount') || '1') - 0
  for (let i = 1; i <= ysmcount; i++) {
    let hd = $.getjson(`ysmhd${i>1?i:''}`)
    let tx = $.getdata(`ysmtx${i>1?i:''}`)
    if (hd) {
      let data = (hd['Referer'] || hd['referer'] || '').match(/^(https?:\/\/.+?\/)redirect\/(.+?)\?openid=([^&]*)(&|$)/)
      let openid = data && data[3]
      if (openid) {
        ysmArr.push({
          openid: openid,
          domain: data[1],
          secret: data[2],
          ua: hd['User-Agent'] || hd['user-agent'],
          txbody: tx || ''
        })
      }
    }
  }
  if (ysmArr.length > 0) {
    let existsId = ysm.map(o => o.openid)
    for (let ac of ysmArr) {
      if (!existsId.includes(ac.openid)) {
        ysm.push(ac)
        existsId.push(ac.openid)
      }
    }
    $.setdata(JSON.stringify(ysm, null, 2), 'ysm')
    $.msg($.name, "", `迁移账号数：${ysmArr.length}\n合计账号数：${ysm.length}！`)
  } else {
    $.log('无待迁移的旧数据')
  }
}

// 金币信息查询
function ysm4(ac) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.domain}gold?openid=${ac.openid}&time=${Date.parse(new Date())}`,
      headers: ac.headers
    }
    $.get(opts, (err, resp, data) => {
      try {
        if (err) {
          $.logErr(`❌ 账号${ac.no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0 && result.data) {
            ac.last_gold = (result.data.last_gold || 0) - 0
            ac.day_read = (result.data.day_read || 0) - 0
            ac.day_gold = (result.data.day_gold || 0) - 0
            ac.remain_read = (result.data.remain_read || 0) - 0
          }
        }
      } catch (e) {
        $.logErr(`======== 账号 ${ac.no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve()
      }
    })
  })
}

//云扫码领取
function ysm3(ac, time) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.domain}add_gold`,
      headers: ac.headers,
      body: `openid=${ac.openid||''}&time=${time}`
    }
    $.post(opts, (err, resp, data) => {
      let f = -1
      try {
        if (err) {
          $.logErr(`❌ 账号${ac.no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0 && result.data) {
            ac.last_gold = (result.data.last_gold || 0) - 0
            ac.day_read = (result.data.day_read || 0) - 0
            ac.day_gold = (result.data.day_gold || 0) - 0
            ac.remain_read = (result.data.remain_read || 0) - 0
            if (ac.remain_read <= 0) {
              f = 0
              $.msg(`${$.name}: 账号${ac.no}`, '', `今日阅读已达上限，请明日继续`)
            } else {
              f = 1
            }
            $.log(`🌝账号${ac.no}：本次奖励：${result.data.gold}, 当前余额: ${ac.last_gold}`, `今日阅读次数: ${ac.day_read}, 今日阅读奖励: ${ac.day_gold}`, `今日剩余阅读次数：${ac.remain_read}`)
          } else {
            $.logErr(`🚫账号${ac.no}：${result.msg}，跳过本次循环\n${data}`)
            if (result.msg == '来晚了，当前任务已结束') {
              f = 1
            }
          }
        }
      } catch (e) {
        $.logErr(`======== 账号 ${ac.no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve(f)
      }
    })
  })
}

//云扫码提交     
function ysm2(ac, jumpLink) {
  return new Promise((resolve) => {
    let opts = {
      url: jumpLink,
      headers: ac.headers
    }
    $.get(opts, (err, resp, data) => {
      let rtObj = ''
      try {
        if (err) {
          $.logErr(`❌ 账号${ac.no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          rtObj = $.toObj(data, {})
        }
      } catch (e) {
        $.logErr(`======== 账号 ${ac.no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve(rtObj)
      }
    })
  })
}

//云扫码key
function ysm1(ac, count) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.domain}task`,
      headers: ac.headers,
      body: ac.body
    }
    $.post(opts, async (err, resp, data) => {
      let f = -1
      try {
        if (err) {
          $.logErr(`❌ 账号${ac.no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0 && result.data && result.data.link) {
            $.log(`\n🌝账号${ac.no}获取key回执成功，第${count}次跳转观看💦`)
            let jumpLink = (result.data.link.match(/redirect_uri=(.*?)(&|#wechat_redirect|$)/) || ['', result.data.link])[1]
            let jumpObj = await ysm2(ac, unescape(jumpLink))
            if (jumpObj) {
              let time = parseInt(Math.random() * (12 - 8 + 1) + 8, 10)
              $.log(`🌝账号${ac.no}等待${time}秒后提交本次观看, jump接口结果：\n${JSON.stringify(jumpObj, null, 2)}`)
              await $.wait(time * 1000)
              f = await ysm3(ac, time)
            } else {
              $.log(`🌝账号${ac.no}jump接口请求失败，重新执行阅读任务`)
              await $.wait(1500)
            }
          } else {
            $.logErr(`🚫账号${ac.no}：获取key回执失败：${(result.data && result.data.msg) || result.msg}`)
            f = -2
            await $.wait(1500)
          }
        }
      } catch (e) {
        $.logErr(`======== 账号 ${ac.no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve(f)
      }
    })
  })
}


//云扫码兑换
function ysmdh(ac, gold) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.domain}user_gold`,
      headers: ac.headers,
      body: `${ac.txbody.match(/(openid=.*?)ua/)[1]}gold=${gold}`
    }
    $.post(opts, async (err, resp, data) => {
      let msg = ''
      try {
        if (err) {
          $.logErr(`❌ 账号${ac.no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0) {
            $.log(`🌝云扫码账号${ac.no} 提现兑换成功：兑换金额${result.data.money}元，前去微信提现'`)
            await $.wait(1000)
            msg = await ysmwx(ac, result.data.money)
          } else {
            msg = `🚫微信提现兑换失败：${result.msg}`
          }
        }
      } catch (e) {
        $.logErr(`======== 账号 ${ac.no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve(msg)
      }
    })
  })
}


//云扫码提现
function ysmwx(ac, money) {
  return new Promise((resolve) => {
    let opts = {
      url: `${ac.domain}withdraw`,
      headers: ac.headers,
      body: ac.txbody
    }
    $.post(opts, async (err, resp, data) => {
      let msg = ''
      try {
        if (err) {
          $.logErr(`❌ 账号${ac.no} API请求失败，请检查网络后重试\n url: ${opts.url} \n data: ${JSON.stringify(err, null, 2)}`)
        } else {
          const result = JSON.parse(data)
          if (result.errcode == 0) {
            $.log(`🌝云扫码账号${ac.no} 微信提现成功：${result.msg}`)
            msg = `已成功提现至微信${money}元`
          } else {
            msg = `🚫微信提现回执失败：${result.msg}`
          }
        }
      } catch (e) {
        $.logErr(`======== 账号 ${ac.no} ========\nurl: ${opts.url}\nerror:${e}\ndata: ${resp && resp.body}`)
      } finally {
        resolve(msg)
      }
    })
  })
}

function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r)));let h=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];h.push(e),s&&h.push(s),i&&h.push(i),console.log(h.join("\n")),this.logs=this.logs.concat(h)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
