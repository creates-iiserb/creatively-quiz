config = require('./configEnv')
// console.log(config)
const nano = require('nano')(config['dbServer']);
const gDb = nano.db.use(config['configDBName'])

module.exports.generateConfig = async ()=>{
    let data1 = await gDb.get(config['configDocName']);
    let envC = data1['env'];
    let progC = data1['prog'];
    let data2 = Object.assign(envC, progC)
    config = Object.assign(config, data2);
}