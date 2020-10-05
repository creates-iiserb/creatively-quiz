let out = (data,st=true,msg='') =>{    
    if(st){
      
      console.log("=="+msg+" start==")    
      console.log(JSON.stringify(data,null,2));
      console.log("=="+msg+" end==")
    }    
}

module.exports = { out }