!function () {
    var e, i = navigator.appName,
        r = navigator.userAgent,
        o = r.match(/(opera|chrome|safari|firefox|msie|trident)\/?\s*(\.?\d+(\.\d+)*)/i);

    o && null != (e = r.match(/version\/([\.\d]+)/i)) && (o[2] = e[1]);

    var a = (o = o ? [o[1], o[2]] : [i, navigator.appVersion, "-?"])[1].split(".");

    if ("Opera" == o[0] || "Msie" == o[0] || "Trident" == o[0] || "Chrome" == o[0] && a[0] < 54 || "Safari" == o[0] && a[0] < 9) {
        (document.getElementsByTagName("body")[0].innerHTML += "<div id='warning' style='width:100%;height:100%;margin:0;padding:0;top:0;left:0;position:absolute; background:rgba(0,0,0,.6);'><style>.msg{background:rgb(255,255,255);padding:20px;border:solid 5px #517D8E; font-size:14px; width:40%; margin:12% auto 0 auto;border-radius:5px;}@media (min-width:700px) and (max-width: 1200px){.msg{width:70%;margin-top:18%;}}@media (min-width:200px) and (max-width: 700px){.msg{width:95%;margin-top:25%;}}</style><div class='msg' style=''><b>&#9888; Your browser does not support some of the features. (" + o[0] + " Version: " + a[0] + ")</b><br/><b>&check;</b> Please use one of the recommended browsers:<ul><li>Chrome Version 54 or Above</li><li>Safari Version 9.3 or Above</li></ul><br/></div></div>");

    }
    
    window.hideMe = function () {
        document.getElementById("warning").style.display = "none"
    }
}();