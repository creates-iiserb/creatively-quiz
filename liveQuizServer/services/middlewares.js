
const cfg = require("./config")
responseHandler = (req, res, next) => {
   
    res.success = (data) => {
        res.json({
            status: true,
            data: data
        });
    };

    res.error200 = (data) => {
        console.log(data)
        let dt = {}

        if (data.message) {
            try{
                dt = JSON.parse(data.message);
            }catch(err){
                dt = data.message;
            }
            
        } else {
            dt = data
        }
        res.json({
            status: false,
            error: dt
        });
    }

    res.error = (err, code, message) => {
       
        if (err) {
            next(err);
        } else {
            next(Error(code + "#@#" + message));
        }
    }

    next();
}
module.exports.responseHandler = responseHandler;





