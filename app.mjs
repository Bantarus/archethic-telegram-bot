import archethic from "archethic";
import fetch from "cross-fetch";
import { Telegraf, Markup } from "telegraf";
const randomSecretKey = archethic.randomSecretKey;


// custom modules
import  db from "./lib/src/services/database.mjs"
import {UsersDao} from "./lib/src/services/users_dao.mjs"

// telegraf bot instance
const bot = new Telegraf(process.env.BOT_TOKEN)

// Archethic global variables
const archethicEndpoint = "https://testnet.archethic.net";
const testnetOriginKey = "000118be6f071dafc864008de5e52fb83714c976fcdc4d0aa17205fe54e65c6bc904"
const curveType = "ed25519";

// functionnals global variables
const wallet_button_text = "Wallet";
const Generate_wallet_button_text = "Generate Wallet";





var chatMap = new Map();

function generateSeed(){

  const randomString = randomSecretKey();

  return randomString;
}

function generateAddress(seed, index) {
 
  var address = archethic.deriveAddress(seed,index)
  return address;
}

function generatePemText(seed,publicAddress){
  const { privateKey }  = archethic.deriveKeyPair(seed,0);
  var pemText = "-----BEGIN PRIVATE KEY for " + publicAddress + "-----" + "\n";
  pemText+= Buffer.from(privateKey).toString('base64').replace(/.{64}/g, '$&\n') + "\n";
  pemText+= "-----END PRIVATE KEY for "+ publicAddress + "-----";

  return Buffer.from(pemText);
  
  
  
}


// users methods 

function hasUser(users, id ){
  return users.some(user => user.id === id )
}



function getUCOBalance(publicAddress){


  return fetch(archethicEndpoint + "/api", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: `query {
                  balance(address: "${publicAddress}"){
                    uco
                  }
              }`
    })
  })
  .then(r => r.json())
  .then((res) =>{
    if (res.data == null) {
      console.log("res.data is null")
      return 0;
    } else {
      console.log(res.data.balance.uco)
      return res.data.balance.uco;
    }
  });

 
  
}

bot.command('quit', (ctx) => {
  // Explicit usage
  ctx.telegram.leaveChat(ctx.message.chat.id)

  // Using context shortcut
  // ctx.leaveChat()
})

bot.command('start', ctx => {
  var userId = ctx.message.from.id
  db.read()
  if (!hasUser(db.data.users,userId)){
    db.data.users.push({ id : userId})
    db.write()
  }else{
    console.log("Welcome back:" + userId)
  }
  
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["Wallet"],["Help","About"]])
  /*{
    reply_markup: {
      keyboard: [
        [
          { text: "WALLET" }
        ]
      ]
    }
  }
  */)
})

bot.hears("Wallet", ctx =>{
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)
  //if(!chatMap.has(ctx.message.chat.id)){

  if (user !== undefined ){

  
    if(!user.hasOwnProperty('wallet')){

      ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet",
      Markup.keyboard([[Generate_wallet_button_text],["Back"]]))
  
    }
    else{

      getUCOBalance(user.wallet)
      .then((amount)=>{
        return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated.",
        Markup.keyboard([["Wallet : " + user.wallet],
        ["💰 Balance : " + amount],["Back"]]))
        
        })

      


    }
  }

}

)

bot.hears(Generate_wallet_button_text, ctx =>{

  var userId = ctx.message.from.id
  var chatId = ctx.message.chat.id;
  var seed = generateSeed();
  var index = 0;

  var publicAddress = generateAddress(seed,index);
  
  var chatAddressData = {
    seed : seed,
    publicAddress : publicAddress
  }
  var user = UsersDao.getById(userId);
  user.wallet = publicAddress;
  user.seed = seed;
  db.write()
  var pemTextBuffer = generatePemText(seed,publicAddress);
  chatMap.set(ctx.message.chat.id, chatAddressData);

  
  ctx.replyWithDocument({source: pemTextBuffer , filename: publicAddress + ".pem" })
  

  ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated : ")
  ctx.telegram.sendMessage(ctx.message.chat.id, chatMap.get(chatId).publicAddress,
    Markup.keyboard([["Wallet : " + chatMap.get(chatId).publicAddress.toString()],["Back"]]))

})

bot.hears("Back", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["Wallet"],["Help","About"]]))
  
})

bot.hears("Help", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "I'm here to help you set your archethic wallet.")
  
})

bot.hears("About", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Telegram bot done with Telegraf and Archethic javascript libraries.")
  
})

async function getIndex (address){
  await archethic.getTransactionIndex(address,archethicEndpoint)
}

// tip listener
const regex = /^!tip \d+,*\d{0,16}/;
bot.hears(regex, ctx => {
  var rgx = /\d+,*\d{0,16}/;
  var tipValue = rgx.exec(ctx.message.text);
  var user = UsersDao.getById(ctx.message.from.id)


  if(user === undefined ){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You are not registered with me. 🛑`);
  }

  if (ctx.message.reply_to_message?.from?.id === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Tip by replying to another user. 🛑`);
  }

  var recipientID = ctx.message.reply_to_message.from.id
  var recipientUser = UsersDao.getById(recipientID)

  if (recipientUser === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖:@${ctx.message.reply_to_message.from.username} not registered with me ! 🛑`);
  }

  if(recipientID === user.id){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: I will not work for nothing ! You are tipping yourself... 🛑`);
  }


  var recipientUser = UsersDao.getById(recipientID)

  archethic.getTransactionIndex(address, archethicEndpoint
    .then((index) => {
      var tx = archethic.newTransactionBuilder("transfer")
        .addUCOTransfer(recipientUser.wallet, parseFloat(tipValue[0]))
        .build(user.seed, index)
        .originSign(testnetOriginKey)

      console.log(tx.toJSON())

      try {

        archethic.sendTransaction(tx, archethicEndpoint)

        ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You tipped ${tipValue[0]}! 💸`);


      } catch (e) {
        console.log(e.toString())
      }
    }

    )

  )




})

/*
bot.on('text', (ctx) => {
  // Explicit usage
  ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.state.role}`)

  // Using context shortcut
  //ctx.reply(`Hello ${ctx.state.role}`)
})*/

bot.on('callback_query', (ctx) => {
  // Explicit usage
  ctx.telegram.answerCbQuery(ctx.callbackQuery.id)

  // Using context shortcut
  //ctx.answerCbQuery()
})

bot.on('inline_query', (ctx) => {
  const result = []
  // Explicit usage
  ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, result)

  // Using context shortcut
  // ctx.answerInlineQuery(result)
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
