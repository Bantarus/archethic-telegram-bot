import archethic from "archethic";
import fetch from "cross-fetch";
import { Telegraf, Markup, Scenes} from "telegraf";
import LocalSession from 'telegraf-session-local'

const randomSecretKey = archethic.randomSecretKey;




// custom modules
import  db from "./lib/src/services/database.mjs"
import {UsersDao} from "./lib/src/services/users_dao.mjs"

// logger
import log from "./lib/src/services/logger.mjs"
import logger from "./lib/src/services/logger.mjs";
//import { Stage, WizardScene } from "telegraf/typings/scenes/index.js";

// telegraf bot instance
const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const bot = new Telegraf(token)


// Archethic global variables
const archethicEndpoint = "https://testnet.archethic.net";
const testnetOriginKey = "01019280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const curveType = "ed25519";

// functionnals global variables
const wallet_button_text = "Wallet";
const Generate_wallet_button_text = "Generate Wallet";
const callback_data_send = "send"
const callback_data_receive = "receive"
const callback_data_backup_seed = "seed"
const SEND_WIZARD_SCENE_ID = "SEND_WIZARD"


function generatePemText(seed,publicAddress){
  const { privateKey }  = archethic.deriveKeyPair(seed,0);
  var pemText = "-----BEGIN PRIVATE KEY for " + publicAddress + "-----" + "\n";
  pemText+= Buffer.from(privateKey).toString('base64').replace(/.{64}/g, '$&\n') + "\n";
  pemText+= "-----END PRIVATE KEY for "+ publicAddress + "-----";

  return Buffer.from(pemText);
  
  
  
}


function seedStringToUint8Array(seed){

  var seedUint8Array = new Uint8Array(seed.split(",").map( i => parseInt(i)));

  return seedUint8Array;
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
  .catch(error => logger.error(error))
    
  


  // Using context shortcut
  // ctx.leaveChat()
})

bot.command('start', ctx => {
  var userId = ctx.message.from.id
  db.read()
  if (!db.data.users.some(user => user.id === userId )){
    db.data.users.push({ id : userId})
    db.write()
  }else{
    console.log("Welcome back:" + userId)
  }
  
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["Wallet"],["Help","About"]])
  ).catch(error => logger.error(error))
})

bot.hears("Wallet", ctx =>{
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)

  if (user === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You are not registered with me. 🛑`)
      .catch(error => logger.error(error))
  }

  if (!user.hasOwnProperty('wallet')) {

    return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet",
      Markup.keyboard([[Generate_wallet_button_text], ["Back"]]))
      .catch(error => logger.error(error))

  }

   var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
    ["👛 Wallet : " + walletTextToDraw],
    ["▶️ Manage"],
    ["🏠 Back"]
  ]
  
  return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated.",
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))


})


bot.hears(Generate_wallet_button_text, ctx =>{

  var userId = ctx.message.from.id
  var chatId = ctx.message.chat.id;
  var seed = randomSecretKey();
  var index = 0;

  var publicAddress = archethic.deriveAddress(seed,index)
  


  var user = UsersDao.getById(userId);
  if(user === undefined ){
    
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Unknown life form : @${ctx.message.from.username}. 🛑`)
    .catch(error => logger.error(error));
  }

  user.wallet = publicAddress;
  user.seed = seed.toString()
  db.write()
  
  //var pemTextBuffer = generatePemText(seed,publicAddress);

  
  //ctx.replyWithDocument({source: pemTextBuffer , filename: publicAddress + ".pem" })
  //.catch(error => logger.error(error))

  var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
    ["👛 Wallet : " + walletTextToDraw],
    ["▶️ Manage"],
    ["🏠 Back"]
  ]

  ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated :")
    .catch(error => logger.error(error))

  ctx.telegram.sendMessage(ctx.message.chat.id, publicAddress,
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))
})


bot.hears("▶️ Manage", async ctx => {
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)
  var seedUint8Array = seedStringToUint8Array(user.seed)
  
  var textReply = "💰 Wallet balance : ";
  try{
    var index = await archethic.getTransactionIndex(user.wallet, archethicEndpoint)
    var lastAddress = archethic.deriveAddress(seedUint8Array,index)
    var balance =  await getUCOBalance(lastAddress)
    textReply+= balance + " UCO\n"

  }catch(error){
    textReply+= "Unavailable"
    logger.error(error);
  }
 
  

  var inlineKeyboardReply = [
    [{ text : "💸 Send", callback_data : callback_data_send},{ text : "📨 Receive" , callback_data : "some data"}],
    [{ text : "🔑 Backup seed", callback_data : "some data"}]
    
  ]

  try {
    return await ctx.telegram.sendMessage(ctx.message.chat.id, textReply,
      Markup.inlineKeyboard(inlineKeyboardReply));
  } catch (error) {
    logger.error(error);
    return await ctx.telegram.sendMessage(ctx.message.chat.id, "Management keyboard not accessible.");

  }
})



bot.hears("🏠 Back", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["Wallet"],["Help","About"]]))
  .catch(error => logger.error(error))
})

bot.hears("Help", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "I'm here to help you set your archethic wallet.")
  .catch(error => logger.error(error))
})

bot.hears("About", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Telegram bot done with Telegraf and Archethic javascript libraries.")
  .catch(error => logger.error(error))
})




// send action scene
const sendWizard = new Scenes.WizardScene(SEND_WIZARD_SCENE_ID,
  (ctx) => {
    ctx.reply("Which is the recipient public address ?")

    ctx.wizard.state.sendData = {}

    return ctx.wizard.next();

  },
  (ctx) => {

    ctx.wizard.state.sendData.to = ctx.message.text


     
    ctx.reply("UCO amount to send ?")
    
    return ctx.wizard.next();


  },
  (ctx) => {
    
    if(isNaN(Number(ctx.message.text))){
      return ctx.reply("Invalid amount !")
    }

    ctx.wizard.state.sendData.amount = ctx.message.text
    let textReply = "Send to : " + ctx.wizard.state.sendData.to + "\n"
        textReply += "Amount : " + ctx.wizard.state.sendData.amount + " UCO" + "\n"
        textReply += "Do you confirm ? NO|YES"
    ctx.reply(textReply)
    return ctx.wizard.next();
  },
  async (ctx) => {

    // if YES
    // sign transfert on chain 
    //if(ctx.message.text === "YES"){
      try {
      var user = UsersDao.getById(ctx.message.from.id);
      var seedUint8Array = seedStringToUint8Array(user.seed)
      

      var originKey = archethic.getOriginKey()

      archethic.getTransactionIndex(user.wallet, archethicEndpoint)
        .then((index) => {
          var tx = archethic.newTransactionBuilder("transfer")
            .addUCOTransfer(ctx.wizard.state.sendData.to, parseFloat(ctx.wizard.state.sendData.amount))
            .build(seedUint8Array, index)
            .originSign(originKey)
    
          console.log(tx.toJSON())
    
         
    
            archethic.sendTransaction(tx, archethicEndpoint)
            .then( r => {
              console.log(r)
              ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: UCO sent ! 💸`)
              .catch(error => logger.error(error));
            }
            

            )
            .catch(error => error => logger.error(error))
    
            
    
    
          
        }
    
        ).catch(error => error => logger.error(error))
    
      

    } catch (error) {
      logger.error(error)
    }
    //}
    
    
    return ctx.scene.leave();
  })

// add send wizard scene to a middleware
const stage = new Scenes.Stage([sendWizard]);
// register before using enter 

bot.use(new LocalSession({}).middleware())
bot.use(stage.middleware()) 

// send inline button action to enter scene

bot.action(callback_data_send, Scenes.Stage.enter(SEND_WIZARD_SCENE_ID) ) // ctx => ctx.scene.enter(SEND_WIZARD_SCENE_ID))



// tip listener
const regex = /^!tip \d+,\d{1,16}|\d+/;
bot.hears(regex, async ctx => {
  var rgx = /\d+,\d{1,16}|\d+/;
  var tipValue = rgx.exec(ctx.message.text);
  var user = UsersDao.getById(ctx.message.from.id)
  var index = await archethic.getTransactionIndex(user.wallet, archethicEndpoint)
  var seedUint8Array = seedStringToUint8Array(user.seed)
  var lastAddress = archethic.deriveAddress(seedUint8Array,index)

  var userBalance = await getUCOBalance(lastAddress)
  .catch(error => {
    logger.error(error)
    return 0})

  

  if(user === undefined ){
    
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Unknown life form : @${ctx.message.from.username}. 🛑`)
    .catch(error => logger.error(error));
  }

  if (ctx.message.reply_to_message?.from?.id === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey @${ctx.message.from.username}, you can tip by replying to another user. 🛑`)
    .catch(error => logger.error(error));
  }

  if(isNaN(Number(tipValue))){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Invalid Number. 🛑`)
    .catch(error => logger.error(error));
  }

  if (tipValue > userBalance){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey @${ctx.message.from.username}, waiting for payday ? Insufficients funds. 🛑`)
    .catch(error => logger.error(error));
  }

  var recipientID = ctx.message.reply_to_message.from.id
  var recipientUser = UsersDao.getById(recipientID)

  if (recipientUser === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖:@${ctx.message.reply_to_message.from.username} is not registered with me ! 🛑`)
    .catch(error => logger.error(error));
  }

  if(recipientID === user.id){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: I will not work for nothing ! @${ctx.message.from.username} is tipping himself... 🛑`)
    .catch(error => logger.error(error));
  }

  

  var recipientUser = UsersDao.getById(recipientID)

  

  archethic.getTransactionIndex(address, archethicEndpoint)
    .then((index) => {
      var tx = archethic.newTransactionBuilder("transfer")
        .addUCOTransfer(recipientUser.wallet, parseFloat(tipValue[0]))
        .build(seedUint8Array, index)
        .originSign(testnetOriginKey)

      console.log(tx.toJSON())

      try {

        archethic.sendTransaction(tx, archethicEndpoint)

        ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: @${ctx.message.from.username} sent ${tipValue[0]} to @${ctx.message.reply_to_message.from.username} ! 💸`)
        


      } catch (error) {
        logger.error(error)
      }
    }

    )

  
})

/*
bot.on('text', (ctx) => {
  // Explicit usage
  ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.state.role}`)

  // Using context shortcut
  //ctx.reply(`Hello ${ctx.state.role}`)
})

bot.on('callback_query', (ctx) => {
  // Explicit usage
  ctx.telegram.answerCbQuery(ctx.callbackQuery.id)
  .catch(error => logger.error(error));

  console.log(ctx.callbackQuery.data)
  // Using context shortcut
  //ctx.answerCbQuery()
})
*/


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
