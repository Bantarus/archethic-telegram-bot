import { LowSync, JSONFileSync } from 'lowdb'
import * as fs from "fs";

const filePath = "./database/db.json"

try{
    if (!fs.existsSync(filePath)){
        fs.writeFileSync(filePath,JSON.stringify({users : []}))
    }

}catch(error){
    console.error(error)
}
 
const db = new LowSync(new JSONFileSync(filePath));
db.read()

db.data ||= {users : []}
db.write()


export default db;




export function commit(){
        db.write()
    }


