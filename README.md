## Installation and getting started 

**Quiz server (backend)**
- Run `nam install`
- Add configEnv.js file in the `services` folder that contains the following 3 fields :
    - `dbServer` : URL of the couchDb data base
    - `configName`: name of database where other configs are located
    - `configDocName` : id of the record that contains the records 
- To run the server. : `nam start`

