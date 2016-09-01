"use strict";



// 由主调度函数发送过来信息
process.once("message", function(data){

    // 开始本进程的工作
    start(data.threadID, data.startNum, data.endNum)

})


// 进程主函数, 不采用缩进
function start (threadID, startNum, endNum) {



var request  = require("superagent");
var cheerio  = require("cheerio");

var db       = require("./database.js")("B")

var thread   = 8;

// 一个崭新的 Aid 计数器
var biliAidCounter = AidCounter(startNum, endNum);

for(let i = 0; i < thread; i++){
    getMessageByAid(biliAidCounter.next());
}





// getMessageByAid(792)

function getMessageByAid (aid, retryNum) {

    var videoObj = {};

    // 初步获取信息, 其中 cid 的获取较为关键
    request.get(`http://www.bilibili.com/video/av${aid}/`)
        .then((data) => {

            var $ = cheerio.load(data.text);

            // console.log(data.text)

            // 错误处理
            if ($(".z-msg-box").length) {throw new Error("404")}
            if ($("div.scontent").length === 1 && !data.text.match(/cid=(\d+)?&/)) {throw new Error("格式奇葩")}
            if (data.text.indexOf("对不起，你输入的参数有误！") !== -1) {throw new Error("参数错误")}
            if (data.text.indexOf("本视频已撞车或被版权所有者申述，正在转向地址……") !== -1) {throw new Error("内容撞车")}

            videoObj.aid   = aid;
            videoObj.title = $(".qr-info-head").text();
            videoObj.type  = $(".tminfo span").eq(0).text() + " " + $(".tminfo span").eq(1).text();
            videoObj.cid   = data.text.match(/cid=(\d+)?&/)[1];

            // 根据 aid 和 cid 进一步获取信息
            return request.get(`http://interface.bilibili.com/player?id=cid:${videoObj.cid}`)
        })
        .then((data) => {

            var $ = cheerio.load(data.text);
            videoObj.click      = $("click").text();
            videoObj.favourites = $("favourites").text();
            videoObj.coins      = $("coins").text();
            videoObj.danmu      = $("danmu").text();

            return db.collection("videoMessageTest").update({aid : aid}, {$set : videoObj}, {upsert : true})
        })
        .then((data) => {
            log(`aid : ${aid} 已加入数据库!`)
            setTimeout(() => {
                getMessageByAid(biliAidCounter.next());
            }, 2000)
        })
        .catch((err) => {

            // 发生连接错误
            if(err.message.search("getaddrinfo") > -1 || err.message.search("ETIMEDOUT") > -1){

                log(`aid : ${aid} 发送错误: 连接错误, 将在 15 秒钟后重试, 剩余重试次数 ${ retryNum ? retryNum - 1 : 5}`)

                // 到达极限
                if (retryNum === 1) {
                    logWarn(`aid : ${aid} 多次重试后无效, 跳过!`)
                    return getMessageByAid(biliAidCounter.next());
                }

                // 首次犯错
                if(!retryNum) {
                    setTimeout(() => {
                        getMessageByAid(aid, 5);
                    }, 10000 + Math.random() * 15000)
                } else {
                    setTimeout(() => {
                        getMessageByAid(aid, retryNum - 1);
                    }, 10000 + Math.random() * 15000)
                }

                return;
            }

            log(`aid : ${aid} 发送错误: ${err.message}!`)
            setTimeout(() => {
                getMessageByAid(biliAidCounter.next());
            }, 2000)
        })
}

// 计数器类
function AidCounter (initNum, maxNum, step) {

    var aidNum = initNum || 1;
    var maxNum = maxNum || 6000000;
    var step   = step || 1;

    var next = function(){
        var curNum = aidNum;
        aidNum += step;

        if (aidNum > maxNum) {
            log(`获取的 aid 已达到上限 : ${maxNum} , 故进程即将退出`);
            process.exit(0);
        }

        return curNum 
    }

    var getAidNum = function () {
        return aidNum;
    }

    return {next : next, getAidNum : getAidNum}
}

process.stdin.resume();

process.on("SIGINT", function(){
    log(`当前 aid : ${biliAidCounter.getAidNum()}`)
    setTimeout(function(){process.exit(0)}, 0)
});

function log(str){
    if (threadID === undefined) console.log(str);
    else console.log(`${getQueryTime()} 当前进程 : ${threadID} ${str}`)
}

function logWarn(str){
    if (threadID === undefined) console.warn(str);
    else console.warn(`${getQueryTime()} 当前进程 : ${threadID} ${str}`)
}

/**
 * 获取标准时间格式
 */
function getQueryTime(){
    return new Date().toLocaleString()
}

}