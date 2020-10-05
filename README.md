## Installation and getting started 

**Quiz server (/backend)**
- Run `npm install`
- Add configEnv.js file in the `services` folder that contains the following 3 fields :
    - `dbServer` : URL of the couchDb data base
    - `configName`: name of database where other configs are located
    - `configDocName` : id of the record that contains the records 
- To run the server. : `nam start`

**Realtime log server (/realTimeServer)**
- run `npm install`
- start the server : `npm start`

**Mobile app api (/backendApp)**
- run `npm install`
- add configEnv.js inside services folder that contains 3 fields : `dbServer`,`configName`,  and `configDocName`
- start the server using  `npm start`


**Synhronous quiz server(/liveQuizServer)**
- run `npm install`
- add configEnv.js inside services folder that contains 3 fields : `dbServer`,`configName`,  and `configDocName`
- start the server using  `node server.js`

**Frontend quiz web app**
- Following dependencies must be installed
    - [Paperdashboard pro](https://www.creative-tim.com/product/paper-dashboard-pro)
    - [CK editor 4](https://ckeditor.com)
    - [Literally Canvas](http://literallycanvas.com) 