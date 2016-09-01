"use strict";

var cp        = require("child_process");

var thread    = 8;
var totalNum  = 6000;
var startTime = getQueryTime();

var exitNum   = thread;

var threadArr = [];

console.time("Runtime")

for(let i = 0; i < thread; i++){
    threadArr[i] = cp.fork("./thread.js");
    threadArr[i].send({threadID : i, startNum : Math.floor(i * (totalNum / thread)), endNum : Math.floor((i + 1) * (totalNum / thread))})

    threadArr[i].on("exit", () => {
        console.log(`进程 ${i} 已退出!`);
        oneThreadExit();
    })
}


function oneThreadExit(){

    exitNum--;

    if(!exitNum){
        console.log(`程序开始于 : ${startTime}`);
        console.log(`程序结束于 : ${getQueryTime()}`);
        console.timeEnd("Runtime");
        process.exit(0);
    }

}


function getQueryTime(){
    return new Date().toLocaleString()
}