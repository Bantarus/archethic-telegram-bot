import { LowSync, JSONFileSync } from 'lowdb'


const db = new LowSync(new JSONFileSync("db.json"));

db.read()

db.data ||= {users : []}
db.write()


export default db;




export function commit(){
        db.write()
    }


