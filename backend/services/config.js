configData = require("./configEnv");
const nano = require('nano')(configData['dbServer']);
const gDb = nano.db.use(configData['configDBName'])
let generateConfig = async ()=>{
    let data1 = await gDb.get(configData['configDocName']);
    let envC = data1['env'];
    let progC = data1['prog'];
    let data2 = Object.assign(envC, progC)
    configData = Object.assign(configData, data2);
    // console.log(JSON.stringify(configData,null,2))  
}

module.exports.get = async (key) => {
    try {
        // console.log("getting key = ",key)
        // console.log(JSON.stringify(configData,null,2))
        if (Object.keys(configData).length == 3) {
            await generateConfig()
            console.log("Configs loaded from DB")
        }
        if (!configData[key]) {
            throw new Error("Config not found " + key);
        }
        return configData[key]
    } catch (error) {
        throw error
    }
};

module.exports.getEnv = (key) => {
    // console.log("getting env....",key)
    if (!configData[key]) {
        throw new Error("Env config not found " + key);
    }
    // console.log("returning....",configData[key])
    return configData[key]
};

module.exports.getInner = async (key, subKey) => { 
    try {
        // console.log("getting  outer key = ",key,', inner key = ',subKey);
        if (Object.keys(configData).length == 3) {
            // console.log("object not loaded")
            // let configData1 = await gDb.get(configData['configDocName']);
            // configData = Object.assign(data, data1);
            await generateConfig()
            // console.log(data)
            console.log("Configs loaded from DB")
        }

        if (!configData[key]) {
            throw new Error("Config not found " + key);
        }
        // console.log("returning....",configData[key])
        return configData[key][subKey] 
    } catch (error) {
        throw error
    }
};




module.exports.getInnerSync = (key, subKey) => { 
    try {
        // console.log("getting  outer key = ",key,', inner key = ',subKey);
        if (Object.keys(configData).length == 3) {
            // console.log("object not loaded")
            // let configData1 = await gDb.get(configData['configDocName']);
            // configData = Object.assign(data, data1);
            // await generateConfig()
            // console.log(data)
            console.log("Configs not loaded from DB ....alert ...error...do something ")
        }

        if (!configData[key]) {
            throw new Error("Config not found " + key);
        }
        // console.log("returning....",configData[key])
        return configData[key][subKey] 
    } catch (error) {
        throw error
    }
};

