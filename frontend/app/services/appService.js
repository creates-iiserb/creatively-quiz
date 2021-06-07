'use strict';
//utility services
app.service('helperService', function () { 
    //////shuffle array for random questions///////
    this.shuffle = function (array) {
        var currentIndex = array.length, temp, randomIndex;
        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            temp = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temp;
        }
        return array;
    }

    ////////merge object ////////
    this.extend = function (out) {
        out = out || {};

        for (var i = 1; i < arguments.length; i++) {
            if (!arguments[i])
                continue;

            for (var key in arguments[i]) {
                if (arguments[i].hasOwnProperty(key))
                    out[key] = arguments[i][key];
            }
        }
        return out;
    };

    ///////notify msg///////
    this.notifyMsg = function (icon, alert, msg, align1, align2,delayTimer=4000,offsety=null) {
        let options = {
            type: alert,
            delay: delayTimer,
            placement: {
                from: align1,
                align: align2
            }
        }
        if(offsety){
            options['offset']['y'] = offsety;
        }
        
        return $.notify({
            icon: icon,
            message: msg

        },options);
    };

    //remove after testing
    this.utcToLocal = function(date) {
        date = new Date(date);
        var newDate = new Date(date.getTime()+date.getTimezoneOffset()*60*1000);    
        var offset = date.getTimezoneOffset() / 60;
        var hours = date.getHours();    
        newDate.setHours(hours - offset);    
        return newDate.toLocaleString();   
    };
});

//data related services --aamir
app.service('dataService',['$cookies','$window','$http','$rootScope','$timeout', function($cookieStore,$window,$http,$rootScope,$timeout){
    var service = this;
    service.toBool = function (val) {
        if (val == 'undefined' || val == null || val == '' || val == 'false' || val == 'False' || (val == false && typeof val =='boolean'))
            return false;
        else if ( (val == true && typeof val =='boolean') || val == 'true' || val == 'True')
            return true;
        else
            return val;
    };
    ///////get data/////////
    service.getData = function(name){
        return service.toBool($cookieStore.get(name));
    }

    ////////set data///////
    service.setData= function(name,val){
        $cookieStore.put(name, val);
    }
    ////////remove data/////////
    service.removeData = function(name){
        $cookieStore.remove(name);
    }

    service.isShowUserDetail = function(prop){
        let username = null;
        let user = service.getData('USER');
        if(user){
             username = user.toString();
        }
        
        if($rootScope.userDetail.hasOwnProperty(prop)){
           if($rootScope.userDetail[prop]!=username){
               return true;
           }else{
               return false;
           }
        }else{
            return false;
        }
    }

    service.clearSectionLS = function(lsKey,secKey){
        if(typeof(Storage) !== "undefined") {
                let subjectStr = localStorage.getItem(lsKey);
                if (subjectStr) {
                    let subjectObj = JSON.parse(subjectStr);
                    Object.keys(subjectObj).forEach(key => {
                        if(key.startsWith(secKey)){
                          delete subjectObj[key];
                        }
                    });
                    
                    if(Object.keys(subjectObj).length==0){
                        localStorage.removeItem(lsKey);
                    }else{
                        subjectStr = JSON.stringify(subjectObj);
                        localStorage.setItem(lsKey,subjectStr);
                    }
                
                }
        }
    }

    service.clearAllLS = function(subArr){
        if(typeof(Storage) !== "undefined") {
            subArr.forEach(x =>{
                let subjectStr = localStorage.getItem(x);
                if (subjectStr) {
                    let subjectObj = JSON.parse(subjectStr);
                    Object.keys(subjectObj).forEach(key => {
                    let  now = new Date(); 
                    if(now.getTime() > subjectObj[key].expiry  ) {
                            delete subjectObj[key];
                        }
                    });
                    
                    if(Object.keys(subjectObj).length>0){
                        subjectStr = JSON.stringify(subjectObj);
                        localStorage.setItem(x,subjectStr);
                    }else{
                        localStorage.removeItem(x);
                    }
                
                }

            });
        }
    }

    service.setLS = function(lsKey,objKey,objValue,expireAfter){
        if(typeof(Storage) !== "undefined") {
            service.clearAllLS(['subjective']);
            let item = {};
            const itemStr = localStorage.getItem(lsKey);
            if(itemStr){
                item = JSON.parse(itemStr);
            }
            const now = new Date();
            objValue['lastUpdate'] = now.getTime();
            item[objKey] = { 
                value: objValue,
                expiry: now.getTime() + expireAfter
            }
            const jsonData = JSON.stringify(item);
            localStorage.setItem(lsKey,jsonData );
        }
    }

    service.getLS = function(lsKey,objKey){
        if(typeof(Storage) !== "undefined") {
            service.clearAllLS(['subjective']);
            const itemStr = localStorage.getItem(lsKey)
            if (!itemStr) {
              return false;
            }
            const item = JSON.parse(itemStr);
            if(!item[objKey]){
              return false;
            }

            const now = new Date();
            if (now.getTime() > item[objKey].expiry) {
                delete item[objKey];
                localStorage.setItem(lsKey,JSON.stringify(item));
                return false
            }
            return item[objKey].value
        }else{
            return false;
        }
       
    }



    /////////clear all cookies and redirect to login -- in use
    service.clearAll = function(redirect){
       // console.log('DataService clearAll, redirect-'+redirect);
        console.log("clearAll");
        service.removeData('USER');
        service.removeData('ATTEMPT');
        service.setData('LOGGEDIN', 0);
        service.removeData('QUIZID');
        service.removeData('VIEWRES');
        service.removeData('TOKEN');
        service.removeData('reqByAuthor');
        service.removeData('ISSECTION');
        service.removeData('quizType');
        service.removeData('cookieSocketUrl');
        service.removeData('QUESID');
        service.removeData('GRADER_NAME'); 
        service.removeData('GRADER_TOKEN'); 
        if(typeof(Storage) !== "undefined") {
            if (sessionStorage.language) {
                sessionStorage.removeItem("language");
            }
            
        }   
        
        if(redirect){
            if(sessionStorage.getItem('loginToken')){
                window.location = window.location.origin + window.location.pathname+'#/quizList';
                window.location.reload();
            }else{
                window.location = window.location.origin + window.location.pathname;
            }
            
        }
   
    }

    ///////token send with each request -- in use
    service.webAuth = function(){
        const quizId = this.getData('QUIZID');
        const user = this.getData('USER');
        const token = this.getData('TOKEN');
        let webtoken = null;
        if(quizId && user && token){
            webtoken = btoa(quizId+'###'+user+'###'+token);
        }
        return webtoken;
    }

    /////////load ploat chart////////// --in use
    service.getPlotChart = function(){

        $('body').on('click', '.zoomplot', function () {
            let obj = $(this);
            let chartUrl = $(this).attr("data-url");
            $('#overlayIframe').attr('src', chartUrl)
            document.getElementById("overlay").style.display = "block";
        })
        $('body').on('click', '#closeOverlay', function () {
            $('#overlayIframe').attr('src', "")
            document.getElementById("overlay").style.display = "none";
        })

        $(".loadPlot").each(function (index) {
            let plotData, plotLayout;
            let chartUrl = $(this).attr("data-url");
            let chartCaption = $(this).attr("data-caption");
            let obj = $(this);
            let divId = obj.attr("id");
            // obj.addClass("embed-responsive embed-responsive-4by3");
            //plotIframeLink
            let htmltpm = `
            <div class='hidden-xs'>
             <div class='clear-fix'>
                <div class ='pull-right'>
                    <button class='plotlyZoomBtn zoomplot btn btn-sm ' data-url="${$rootScope.configData.plotIframeLink + chartUrl}"><span class="ti-fullscreen"></span></button>
                </div>
             </div>
             <div class='embed-responsive embed-responsive-4by3'>
                <iframe src="${$rootScope.configData.plotIframeLink + chartUrl}"></iframe></div>
             </div>
             <p class='media-caption'>${chartCaption}</p>
            </div>
            <div class='hidden-sm hidden-md hidden-lg'> 
             <img src ='./assets/img/smallPlot.png' class='plotimg zoomplot' data-url="${$rootScope.configData.plotIframeLink + chartUrl}" >
            </div>
            `;;
            obj.html(htmltpm);
        });
    }
    
    ////////load youtube video /////// --in use
    service.getYtVideo = function(){

        $('body').on('click', '.ytbReloadContentBtn', function (event) {
            event.stopImmediatePropagation();

            let obj = $(this);
            let dataSrc =  obj.attr("dataSrc");
            let indexId = obj.attr("data-id");
            let ele = $("#loadVideoDiv"+indexId);
            console.log(dataSrc);

            if(dataSrc == "success"){
                let ytId = obj.attr("data-ytid");
                let url = "https://www.youtube.com/embed/" +ytId + "?autoplay=0&rel=0&iv_load_policy=3&showinfo=1&modestbranding=1&disablekb=1";
                ele.html(`<iframe src='${url}'  width=\"100%\" scrolling=\"no\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"> </iframe>`);
            }

            if(dataSrc == "error"){
                let reqUrl =  obj.attr("data-url");
                obj.attr('disabled', 'disabled');
                $http.get(reqUrl).then(function (response) {
                    let url = "https://www.youtube.com/embed/" + response.data.ytvid + "?autoplay=0&rel=0&iv_load_policy=3&showinfo=1&modestbranding=1&disablekb=1";
                    let html = `<iframe src='${url}'  width=\"100%\" scrolling=\"no\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"></iframe>`;
                    ele.html(html);
                    obj.removeAttr("disabled");
                });
            }

        })

    
       
        if($(".ytbReloadContentBtnDiv").length>0){
            $(".ytbReloadContentBtnDiv").remove();
            console.log("ytbReloadContentBtnDiv");
        }

        $(".loadVideo").each(function (index) {
            let dataUrl = $(this).attr("data-url");
            let datasrc = $(this).attr("data-vsource");
            let chartCaption = $(this).attr("data-caption");
            let obj = $(this);
            //Add caption and class
            obj.addClass("embed-responsive embed-responsive-16by9");
            obj.append("<p class='media-caption'>" + chartCaption + "</p>");
            obj.html('');
            if (dataUrl) {   
                // data url exists
                let indexId = index;
                let reqUrl = $rootScope.configData.youTubeUrl + dataUrl;
                $http.get(reqUrl).then(function (response) {
                    let url;
                    if (datasrc == 'youtube') {
                        url = "https://www.youtube.com/embed/" + response.data.ytvid + "?autoplay=0&rel=0&iv_load_policy=3&showinfo=1&modestbranding=1&disablekb=1";
                        let temp = `<div id="loadVideoDiv${index}"><iframe src='${url}'  width=\"100%\" scrolling=\"no\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"> </iframe></div> `;
                        obj.html(temp);
                        //let btn = `<div class="ytbReloadContentBtnDiv"><br><button  data-id="${index}" data-url="${reqUrl}" data-ytid="${response.data.ytvid}"    class="ytbReloadContentBtn btn btn-default btn-xs pull-right" type="button" title="Reload video, in case video is not display" dataSrc="success" ><i class="fa fa-refresh"></i> Reload</button><br><br></div>`;
                        //$(btn).insertAfter(obj);
                    }
                   
                },function(err){
                   console.log('potato not responding');
                   let temp = `<div id="loadVideoDiv${indexId}"></div> `;
                   obj.html(temp);
                   //let btn = `<div class="ytbReloadContentBtnDiv"><br><button data-id="${indexId}" data-url="${reqUrl}" dataSrc="error"  class="ytbReloadContentBtn btn btn-default btn-xs pull-right" type="button" title="Reload video, in case video is not display" ><i class="fa fa-refresh"></i> Reload</button><br><br></div>`;
                    //$(btn).insertAfter(obj);

                });
            } else {
                let dataid = $(this).attr("data-vid");
                let url;
                if (datasrc == 'youtube') {
                    url = "https://www.youtube.com/embed/" + dataid + "?autoplay=0&rel=0&iv_load_policy=3&showinfo=1&modestbranding=1&disablekb=1";
                    let temp = `<div id="loadVideoDiv${index}"><iframe src='${url}'  width=\"100%\" scrolling=\"no\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"> </iframe></div>`;
                    obj.html(temp);
                    //let btn = `<div class="ytbReloadContentBtnDiv"><br><button data-id="${index}" data-ytid="${dataid}" dataSrc="success" title="Reload video, in case video is not display" class="ytbReloadContentBtn btn btn-default btn-xs pull-right" type="button"><i class="fa fa-refresh"></i> Reload</button> <br><br></div>`;
                    //$(btn).insertAfter(obj);
                }
                
            }

        });
    }

    //////load pdf doc ///////--in use
    service.getPdfDoc = function(){

        $('body').on('click', '.pdfReloadContentBtn', function (event) {
            event.stopImmediatePropagation();
            let obj = $(this);
            let url =  obj.attr("data-url");
            let indexId = obj.attr("data-id");
            let ele = $("#loadPdfDocDiv"+indexId);
            ele.html(`<iframe src='${url}'  width=\"100%\" scrolling=\"no\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"> </iframe>`);
        });

        if($(".pdfReloadContentBtnDiv").length>0){
            $(".pdfReloadContentBtnDiv").remove();
            console.log("pdfReloadContentBtnDiv");
        }

        $(".loadPDF").each(function (index) {
            let dataUrl = $(this).attr("data-url");
            let chartCaption = $(this).attr("data-caption");
            let obj = $(this);
            obj.html('');
            //Add caption and class
            obj.addClass("embed-responsive embed-responsive-16by9");
            obj.append("<p class='media-caption'>" + chartCaption + "</p>");
            if (dataUrl) {
                let url = $rootScope.configData.pdfDocUrl+dataUrl;
                let temp = `<div id="loadPdfDocDiv${index}"><iframe src='${url}'  width=\"100%\" scrolling=\"no\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"> </iframe></div>`;
                obj.html(temp);
                //let btn = `<div class="pdfReloadContentBtnDiv"><br><button data-id="${index}" data-url="${url}" class="pdfReloadContentBtn btn btn-default btn-xs pull-right" type="button" title="Reload PDF Document, in case PDF is not display"><i class="fa fa-refresh"></i> Reload</button><br><br></div>`;
                //$(btn).insertAfter(obj);
            } 

        });
    }

 


   //////////error swal with redirect /////--in use
    service.swalAndOut = function(msg,type,btntype){
        console.log("swalAndOut");
        this.clearAll(false);
        if($(".pageLoader").length>0){
            $(".pageLoader").remove();
        }

        if($("html").hasClass("nav-open")){
            $('.navbar-toggle').click(); 
        }

        swal({
        text:msg,
        type:type,
        buttonsStyling: false,
        allowOutsideClick: false,
        confirmButtonClass: "btn "+ btntype +" btn-fill"
        }).then(function () {
            $window.location.href = window.location.origin + window.location.pathname;   
        });

    }

    //--in use
    service.swalAndRedirect = function(msg,type,btntype,exitReason){
        console.log("swalAndRedirect");
        if($(".pageLoader").length>0){
            $(".pageLoader").show();
        }

        let uname = this.getData('USER');
        let quizId = this.getData('QUIZID');
        if(!uname){
            $window.location.href = window.location.origin + window.location.pathname; 
        }
        var baseUrl = this.getData('cookieBaseUrl');
        var data = {
            uname:uname,
            quizId:quizId,
            message:exitReason
        }
        var accessToken =  this.webAuth();
        let  reqByAuthor= this.getData('reqByAuthor');
        if (reqByAuthor){
            data.reqByAuthor = JSON.parse(reqByAuthor);
        }
             
        $http({
               method:'POST',
               withCredentials:true,              
               url:baseUrl+'/exitQuiz',
               headers: {
                'authToken': accessToken
               },
               data:data
        }).then(function(res){
            $rootScope.$broadcast("lq_socketDisconnect");
            service.swalAndOut(msg,type,btntype);
        },function(error){
            $rootScope.$broadcast("lq_socketDisconnect");
            service.swalAndOut(msg,type,btntype);
            console.log(error);
        });
    }

   //////////used when other window or console is open/////// --in use
    service.onFocusOut = function(flag){
       if(!flag)
       {
            $(window).on('blur', function () {
                //console.log("blue function")
                // check focus
                if ($('iframe').is(':focus')) {
                   console.warn('focus shifted to iframe');
                }
                else {
                    let msg = $rootScope.language.alert_changedWindowFocus;
                    if(!msg){
                       msg = $rootScope.language.caption_reloadLogout;
                    }
                   
                    var hash = location.hash.substr(1);
                    $rootScope.$broadcast('onFocusOutWin',{hash:hash});
                    setTimeout(function(){ 
                       service.swalAndRedirect(msg,'warning','btn-warning','windowChanged');
                    }, 1500);
                }
            });
       }

   }

    service.loggoutWithReason = function(reason){
        if($(".pageLoader").length>0){
            $(".pageLoader").show();
        }

        if($("html").hasClass("nav-open")){
            $('.navbar-toggle').click(); 
        }

        service.removeData('ATTEMPT');
        service.setData('LOGGEDIN', 0);
        var baseUrl = this.getData('cookieBaseUrl');
        var data = {
            uname:this.getData('USER'),
            quizId:this.getData('QUIZID'),
            message:reason
        }
        var accessToken =  this.webAuth();
        let  reqByAuthor= this.getData('reqByAuthor');
        if (reqByAuthor){
            data.reqByAuthor = JSON.parse(reqByAuthor);
        }
             
        $http({
               method:'POST',
               withCredentials:true,              
               url:baseUrl+'/exitQuiz',
               headers: {
                'authToken': accessToken
               },
               data:data
        }).then(function(res){
           service.clearAll(true)
        },function(error){
            console.log(error);
            service.clearAll(true);
        });
    }

   ////////////check internet connection//////////
    service.checkInternet = function(){
        if(navigator.userAgent.indexOf("Chrome") != -1 || navigator.userAgent.indexOf("Firefox") != -1 || navigator.userAgent.indexOf("Safari") != -1)
        {            
            var internetCheck = setInterval(function(){
            if(!navigator.onLine){
                alert("Internet Disconnected");   
                clearInterval(internetCheck);
                $timeout(function() {
                    service.clearAll(true);
                },0);
                
            }
        },1000);
        }            
    }

   
    service.createGuage = function(Status_data,cssId,element){
        let timeTakenLable =  Status_data.timeType=="min" ? "Time Taken(min) " :"Time Taken(sec)"; 
        var guagedata = [
          {
            type: "indicator",
            mode: "gauge+number+delta",
            value: (cssId==="averagetime")? Status_data.Time.yours : Status_data.Score.yours,
            title: { text: (cssId==="averagetime")? timeTakenLable : "Score", font: { size: 16 } },
            delta: { reference:(cssId==="averagetime")?  Status_data.Time.Avg :Status_data.Score.Avg, increasing: { color: "#ef8157" } },
            responsive: true,
            gauge: {
              axis: (cssId==="averagetime")? { range: [ Status_data.Time.Min,Status_data.Time.Max],tickmode :"auto" }:
              { range: [ Status_data.Score.Min,Status_data.Score.Max],tickmode :"auto"},
              responsive: true,
              bar: { color: "#51cbce" },
              bgcolor: "#fbc65847",
              borderwidth: 1,
              bordercolor: "white",
              threshold: {
                line: { color: "#ef8157", width: 3},
                thickness: 2,
                value: (cssId==="averagetime")?  Status_data.Time.Avg :Status_data.Score.Avg
                
              }
            }
          }
        ];

        
        var layout = {
          paper_bgcolor: "#fcfcfc",
          font: { color: "black", family: "Arial" },
          width:390,
          height: 280
        };

        var config = {responsive: true,displayModeBar: false};
        let guageEle = document.getElementById(element);
        if(guageEle){
          Plotly.newPlot(guageEle, guagedata, layout,config);
        }
        
    }

}])

//--server request services
app.service('requestService',['$http','$rootScope','dataService','helperService', function($http,$rootScope,dataService,helperService){
    this.request = function(method,withCredentials,api,data){
        var baseUrl = dataService.getData('cookieBaseUrl');
        /////////new code //////
        let  reqByAuthor= dataService.getData('reqByAuthor');
        if (reqByAuthor){
            data.reqByAuthor = JSON.parse(reqByAuthor);
        }
        //when pass token always use Token suffix eg: graderToken 
        let headers = {};
        headers['authToken'] =  dataService.webAuth();//quiz Token
        if(data.graderToken){
            headers['authToken'] = data.graderToken; //grader Token
            delete data.graderToken;
            delete data.reqByAuthor;
        }
        if(data.loginToken){
            headers['loginToken'] = data.loginToken;
            delete data.loginToken;
            delete data.reqByAuthor;
        }
        /////////end of new code /////
        
          return $http({
               method:method,
               withCredentials:withCredentials,              
               url:baseUrl+api,
               headers: headers,
               data:data,
               timeout:15000
          });
    }


    this.download = function(method,withCredentials,api,data){
        var baseUrl = dataService.getData('cookieBaseUrl');
        if(!data.hasOwnProperty('reqByAuthor')){
           
             let  reqByAuthor= dataService.getData('reqByAuthor');
             if (reqByAuthor){
                 data.reqByAuthor = JSON.parse(reqByAuthor);
             }
            
        }
        var accessToken =  dataService.webAuth();
          return $http({
               method:method,
               withCredentials:withCredentials,              
               url:baseUrl+api,
               responseType: "arraybuffer",
               headers: {
                'authToken': accessToken
               },
               data:data
          });
    }

    /////////////server error handler////////
    this.dbErrorHandler = function(errorCode,errorType){
        console.log('DB Warning');   
        console.log("ErrorCode-"+errorCode);
        console.log("ErrorType-"+ errorType);
        console.log("Message-"+$rootScope.language[errorCode]); 
        if(errorCode==="authFailed"){           
            dataService.swalAndRedirect($rootScope.language[errorCode],'error','btn-danger','loggedOutSessionExpired');
        }   
        else{            
            //dataService.setData('LOGGEDIN', 0);

            helperService.notifyMsg('ti-alert', errorType, $rootScope.language[errorCode], 'top', 'center');
        }
    }
}])

//--custom filter
app.filter('qTypeUpper', function() {
    return function(input) {
        if(input){
            if(input == "sub"){
                return 'Subjective';
            }else
            if(input == 'fillIn'){
                return 'Fill in';
            }else
            if(input =='mcq'){
               return 'MCQ';
            }else{
                return (input.length > 0) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : input;
            }
        }
    }
  
});

// app.filter('findReplace', function() {
//     return function(input,replaceWith) {
//         if(input){
//             return input.replace("###", replaceWith);
//         }
//     }
// });

//please use this  placeholder only ### @@@ &&& %%% in global language database; 
app.filter("findReplace", ['$sce', function($sce) {
    return function(input,replaceWith) {
        if(input){
            var re = new RegExp(Object.keys(replaceWith).join("|"),"gi");
            let str = input.replace(re, function(matched){
                return replaceWith[matched.toLowerCase()];
            });
            return $sce.trustAsHtml(str);
        }
    }
}]);

app.filter("plusminus",function(){
    return function(inp){
        inp = +inp;
        if(inp>0){
            inp = inp.toFixed(2);
            return "+"+inp;
        }else if(inp<0){
            inp = inp.toFixed(2);
            return inp;
        }else if(inp ===0){
            return "0.00";
        }
    }
})

app.filter("textTrim",function(){
	return function (text,len) {
		if(text){
			if(text.length>len){
                if(text.includes('@')){
                  let index = text.indexOf('@');
                  text = text.substr(0,index);
                }else{
                    text = text.substr(0,len)+'...';
                }
                
            }
			return text;
		}else{
			return text;
		}
        
    }
});

app.filter("toLocalTime",function(){
	return function (utcDate) {
		if(utcDate){
            var d1 = new Date(utcDate);
            return d1.toString();
		}
    }
});


//return hh:mm:ss format
app.filter("secondToString",function(){
    return function (given_seconds) {
        let hours = Math.floor(given_seconds / 3600);
        let minutes = Math.floor((given_seconds - (hours * 3600)) / 60);
        let seconds = Math.floor(given_seconds - (hours * 3600) - (minutes * 60));

        let timeString = hours.toString().padStart(2, '0') + ':' +
            minutes.toString().padStart(2, '0') + ':' +
            seconds.toString().padStart(2, '0');
        // console.log(timeString)
        // return Math.round(difference_ms / one_minutes);
        return timeString
    }
});


app.filter("utcToLocal",function($filter){
    return function (utcDateString, format) {
        if (!utcDateString) {
            return;
        }
        const timestamp = new Date(new Date(utcDateString).toString()).getTime();
        return $filter('date')(timestamp, format);
    };

});

