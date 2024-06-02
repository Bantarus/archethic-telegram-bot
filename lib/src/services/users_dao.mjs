import db from "./database.mjs"


export class UsersDao {

    constructor() {

    }

    static getAll() {
        return db.data.users
    }

    static save(user) {
        db.data.users.push(user);

    }



    static getById(id) {
        return db.data.users.find(user => user.id === id)
    }

    static getByName(name) {
        return db.data.users.find( user => user.name === name)
    }

  
    static hasUser(users, id) {
        return users.some(user => user.id === id)
    }


}


