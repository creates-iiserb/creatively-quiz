var fs = require('fs');
var ejs = require('ejs');
var pdf = require('html-pdf');
var path = require('path');
 
function toHTML(ejsTemplateURL, data) {
    return new Promise(function (resolve, reject) {
        // console.log(path.join(rootDirLoc,ejsTemplateURL))
        fs.readFile(path.join(rootDirLoc,ejsTemplateURL), 'utf8', function (error, response) {
            if (error) {
                reject(error);
            }
            else {
                var html = ejs.render(response, data);
                resolve(html);
            }
        });
    });
}

function toPDF(html) {

    return new Promise(function (resolve, reject) {
        var options = { format: 'A4', orientation: 'landscape' };
        pdf.create(html, options).toBuffer(function (err, pdfBfr) {  
            // console.log('This is a buffer:', Buffer.isBuffer(resolve));
            if(err){
                reject(err)
            }
            resolve(pdfBfr)
        });
    });

}

let generatePdfSummary = (data) => {
    let a = JSON.parse(JSON.stringify(data))
    a.summary.map(itm=>{
        if(itm["correct"]=="NA"){
            itm["correct"]=0
        }
    })
    return new Promise((resolve, reject) => {
        toHTML('/services/pdfTemplate.ejs', {data:a})
            .then(function (html) {
                return toPDF(html)
            })
            .then(pdf => {
                resolve(pdf)
            })
            .catch(error => {
                console.error(error);
            });
    })
}

module.exports = {
    generatePdfSummary : generatePdfSummary
}